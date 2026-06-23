/**
 * SQLite connection + schema migrations.
 *
 * Local-first, fully offline, no account (DESIGN.md §2). One on-device database
 * opened once and shared.
 *
 * Migrations are an ordered, append-only list. `PRAGMA user_version` stores how
 * many have run; on open we apply any new ones in a transaction. To evolve the
 * schema, append a migration — never edit or reorder a shipped one.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'books.db';

interface Migration {
  /** Human-readable name, for logs/debugging. */
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_initial_schema',
    up: async (db) => {
      await db.execAsync(`
        -- Singleton row of user preferences (id is always 1).
        CREATE TABLE settings (
          id                    INTEGER PRIMARY KEY CHECK (id = 1),
          weekly_target         INTEGER NOT NULL DEFAULT 5,
          max_freezes           INTEGER NOT NULL DEFAULT 3,
          reminder_enabled      INTEGER NOT NULL DEFAULT 0,
          reminder_hour         INTEGER NOT NULL DEFAULT 20,
          reminder_minute       INTEGER NOT NULL DEFAULT 0,
          yearly_goal           INTEGER,
          -- Freeze economy (see lib/freezes.ts): total freezes ever earned and
          -- the highest streak length already credited, so earning is monotonic.
          freezes_earned        INTEGER NOT NULL DEFAULT 0,
          freeze_credit_streak  INTEGER NOT NULL DEFAULT 0,
          created_at            TEXT    NOT NULL
        );

        -- One row per day the user marked "I read today".
        -- date is the local calendar day as 'YYYY-MM-DD'.
        CREATE TABLE reading_days (
          date       TEXT PRIMARY KEY,
          pages      INTEGER,
          book_id    INTEGER REFERENCES books(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL
        );

        -- Books on the user's shelves.
        CREATE TABLE books (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          open_library_key  TEXT,
          title             TEXT NOT NULL,
          author            TEXT,
          cover_url         TEXT,
          cover_width       INTEGER,
          cover_height      INTEGER,
          total_pages       INTEGER,
          current_page      INTEGER NOT NULL DEFAULT 0,
          shelf             TEXT NOT NULL DEFAULT 'want_to_read'
                              CHECK (shelf IN ('want_to_read', 'reading', 'finished')),
          started_at        TEXT,
          finished_at       TEXT,
          sort_order        INTEGER NOT NULL DEFAULT 0,
          created_at        TEXT NOT NULL
        );

        -- A frozen week, keyed by its Monday ('YYYY-MM-DD').
        CREATE TABLE week_freezes (
          week_start TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE INDEX idx_reading_days_book ON reading_days(book_id);
        CREATE INDEX idx_books_shelf ON books(shelf);
      `);
      await db.runAsync(
        'INSERT INTO settings (id, created_at) VALUES (1, ?);',
        [new Date().toISOString()]
      );
    },
  },
  {
    // First-run onboarding flag (DESIGN.md onboarding flow). 0 = not yet onboarded,
    // so existing installs and the singleton row both start needing onboarding.
    name: '002_onboarding_complete',
    up: async (db) => {
      await db.execAsync(
        `ALTER TABLE settings ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0;`
      );
    },
  },
  {
    // Cached rich metadata fetched from Open Library's Works/Ratings APIs,
    // keyed by the same open_library_key the books table stores. Separate from
    // `books` because it's a derived network cache (stale-while-revalidate via
    // fetched_at, see book-details-repo.ts), not user-owned state, and one work
    // can back several library entries. `subjects` is a JSON-encoded string[].
    name: '003_book_details_cache',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE book_details (
          open_library_key   TEXT PRIMARY KEY,
          description        TEXT,
          subjects           TEXT,
          first_publish_year INTEGER,
          rating_average     REAL,
          rating_count       INTEGER,
          -- ISO timestamp of the last successful network fetch, or NULL when the
          -- row only holds seeded data (e.g. year from a search result) and a
          -- full fetch is still pending. NULL counts as stale.
          fetched_at         TEXT
        );
      `);
    },
  },
  {
    // Generic key-value cache for derived network responses that aren't keyed to
    // a single book (e.g. the trending list). `payload` is the JSON-encoded
    // value; `fetched_at` drives the TTL / stale-while-revalidate read in
    // api-cache-repo.ts. Not user-owned state — safe to drop and refetch.
    name: '004_api_cache',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE api_cache (
          key        TEXT PRIMARY KEY,
          payload    TEXT NOT NULL,
          fetched_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    // Timed reading sessions: pick a book, run a timer, record pages on finish.
    // The single active session is the row with ended_at IS NULL; finishing
    // stamps duration, advances the book's progress, and accumulates pages into
    // reading_days (see sessions-repo.ts). session_date is the local day the
    // session *started*, so a session begun before midnight counts toward that
    // night. Sessions cascade-delete with their book — a session has no meaning
    // without one.
    name: '005_reading_sessions',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE reading_sessions (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id          INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          started_at       TEXT    NOT NULL,
          ended_at         TEXT,
          duration_seconds INTEGER,
          pages            INTEGER,
          session_date     TEXT    NOT NULL,
          created_at       TEXT    NOT NULL
        );

        -- At most one active (unfinished) session at a time, enforced by the DB.
        CREATE UNIQUE INDEX idx_sessions_single_active
          ON reading_sessions(ended_at) WHERE ended_at IS NULL;
        CREATE INDEX idx_sessions_book ON reading_sessions(book_id);
        CREATE INDEX idx_sessions_date ON reading_sessions(session_date);
      `);
    },
  },
  {
    // Theme override (Settings → Appearance): 'system' follows the OS, 'light' /
    // 'dark' force it. Existing installs default to 'system' — current behavior.
    name: '006_theme_preference',
    up: async (db) => {
      await db.execAsync(
        `ALTER TABLE settings ADD COLUMN theme_preference TEXT NOT NULL DEFAULT 'system';`
      );
    },
  },
];

let dbPromise: Promise<SQLiteDatabase> | null = null;

/** Open (once) and migrate the database, returning the shared connection. */
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Erase the user's reading data — books, history, sessions, and frozen weeks —
 * and reset the goal/freeze settings to their defaults, keeping the install
 * "onboarded" and the theme preference intact. The derived network caches go too;
 * they refetch on demand. Used by Settings → Reset all data. Irreversible.
 */
export async function resetAllData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM reading_sessions;
      DELETE FROM reading_days;
      DELETE FROM week_freezes;
      DELETE FROM books;
      DELETE FROM book_details;
      DELETE FROM api_cache;
    `);
    await db.runAsync(`
      UPDATE settings SET
        weekly_target = 5,
        max_freezes = 3,
        reminder_enabled = 0,
        reminder_hour = 20,
        reminder_minute = 0,
        yearly_goal = NULL,
        freezes_earned = 0,
        freeze_credit_streak = 0
      WHERE id = 1;
    `);
  });
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const applied = row?.user_version ?? 0;

  for (let version = applied; version < MIGRATIONS.length; version++) {
    const migration = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await migration.up(db);
    });
    // PRAGMA user_version doesn't accept bound params; the value is a trusted int.
    await db.execAsync(`PRAGMA user_version = ${version + 1};`);
  }
}
