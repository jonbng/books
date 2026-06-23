/**
 * Timed reading sessions — start a timer against a book, then finish it with a
 * page count. The single active session is the row with `ended_at IS NULL`
 * (guaranteed at most one by a partial unique index, see migration 005).
 *
 * Finishing is the load-bearing operation: in one transaction it closes the
 * session, advances the book's progress, and folds the pages into reading_days
 * so the existing streak/stats machinery (which reads reading_days) picks them
 * up with no extra step. This module only reads & writes rows; pure duration /
 * aggregation math lives in src/lib/sessions.ts.
 */

import { todayISO } from '@/lib/dates';

import { getDb } from './database.ts';

export interface ReadingSession {
  id: number;
  bookId: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  pages: number | null;
  /** Local calendar day the session started, 'YYYY-MM-DD'. */
  sessionDate: string;
  createdAt: string;
}

interface SessionRow {
  id: number;
  book_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  pages: number | null;
  session_date: string;
  created_at: string;
}

function fromRow(r: SessionRow): ReadingSession {
  return {
    id: r.id,
    bookId: r.book_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSeconds: r.duration_seconds,
    pages: r.pages,
    sessionDate: r.session_date,
    createdAt: r.created_at,
  };
}

const SELECT = `SELECT id, book_id, started_at, ended_at, duration_seconds, pages,
  session_date, created_at FROM reading_sessions`;

async function getSession(id: number): Promise<ReadingSession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>(`${SELECT} WHERE id = ?;`, [id]);
  return row ? fromRow(row) : null;
}

/** The single active (unfinished) session, or null. */
export async function getActiveSession(): Promise<ReadingSession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SessionRow>(`${SELECT} WHERE ended_at IS NULL;`);
  return row ? fromRow(row) : null;
}

/**
 * Start a session for a book. Throws if one is already running — the partial
 * unique index also guards this, but the pre-check inside the transaction gives
 * a friendly message instead of a raw constraint error.
 */
export async function startSession(bookId: number): Promise<ReadingSession> {
  const db = await getDb();
  let insertedId = 0;
  await db.withTransactionAsync(async () => {
    const active = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM reading_sessions WHERE ended_at IS NULL;'
    );
    if (active) throw new Error('A reading session is already in progress');
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO reading_sessions (book_id, started_at, session_date, created_at)
       VALUES (?, ?, ?, ?);`,
      [bookId, now, todayISO(), now]
    );
    insertedId = result.lastInsertRowId;
  });
  const session = await getSession(insertedId);
  if (!session) throw new Error('Failed to start session');
  return session;
}

/**
 * Finish the active session. In one transaction:
 *  1. close the session row (ended_at, duration, pages),
 *  2. advance the book's current_page by `pages` (clamped to total_pages),
 *  3. mark the session's day read and *accumulate* its pages into reading_days.
 *
 * Step 3 deliberately differs from reading-repo.markRead: markRead fills blanks
 * (`COALESCE(excluded.pages, pages)`), which would let a second session in a day
 * overwrite the first's count. Here we sum (`pages + excluded.pages`) so multiple
 * sessions per day add up. (Note: the Today inline editor's setReadingDayDetail
 * still *overwrites* the day total — a manual edit after a session replaces the
 * accumulated sum, which is the accepted behavior.)
 *
 * Idempotent: a no-op if there's no active session.
 */
export async function finishSession(input: {
  pages: number;
  endedAt?: string;
}): Promise<void> {
  const db = await getDb();
  const pages = Math.max(0, Math.round(input.pages));
  await db.withTransactionAsync(async () => {
    const active = await db.getFirstAsync<SessionRow>(
      `${SELECT} WHERE ended_at IS NULL;`
    );
    if (!active) return;

    const endedAt = input.endedAt ?? new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - new Date(active.started_at).getTime()) / 1000)
    );

    // 1. close the session
    await db.runAsync(
      `UPDATE reading_sessions
         SET ended_at = ?, duration_seconds = ?, pages = ?
       WHERE id = ?;`,
      [endedAt, durationSeconds, pages, active.id]
    );

    // 2. advance the book, clamped to total_pages when it's known
    if (pages > 0) {
      await db.runAsync(
        `UPDATE books
           SET current_page = MIN(COALESCE(total_pages, current_page + ?), current_page + ?)
         WHERE id = ?;`,
        [pages, pages, active.book_id]
      );
    }

    // 3. mark the day read, accumulating pages (see doc comment above)
    await db.runAsync(
      `INSERT INTO reading_days (date, pages, book_id, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         pages   = COALESCE(reading_days.pages, 0) + excluded.pages,
         book_id = COALESCE(reading_days.book_id, excluded.book_id);`,
      [active.session_date, pages, active.book_id, new Date().toISOString()]
    );
  });
}

/** Discard the active session without recording anything. */
export async function cancelSession(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reading_sessions WHERE ended_at IS NULL;');
}

/** Finished sessions, newest first. */
export async function listSessions(limit?: number): Promise<ReadingSession[]> {
  const db = await getDb();
  const rows = limit
    ? await db.getAllAsync<SessionRow>(
        `${SELECT} WHERE ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT ?;`,
        [limit]
      )
    : await db.getAllAsync<SessionRow>(
        `${SELECT} WHERE ended_at IS NOT NULL ORDER BY ended_at DESC;`
      );
  return rows.map(fromRow);
}
