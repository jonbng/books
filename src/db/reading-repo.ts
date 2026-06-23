/**
 * The reading log — one row per day the user marked "I read today".
 *
 * Pure streak/stats math lives in `src/lib`; this module only reads & writes rows.
 */

import { addDays, mondayOf, todayISO, weekdayIndex } from '@/lib/dates';

import { getDb } from './database.ts';
import { updateSettings } from './settings-repo.ts';

export interface ReadingDay {
  /** Local calendar day, 'YYYY-MM-DD'. */
  date: string;
  /** Pages read that day, if recorded. */
  pages: number | null;
  /** Book this day's reading was attributed to, if any. */
  bookId: number | null;
}

interface ReadingDayRow {
  date: string;
  pages: number | null;
  book_id: number | null;
}

/** All reading days, ascending by date. */
export async function loadReadingDays(): Promise<ReadingDay[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReadingDayRow>(
    'SELECT date, pages, book_id FROM reading_days ORDER BY date;'
  );
  return rows.map((r) => ({ date: r.date, pages: r.pages, bookId: r.book_id }));
}

/** Mark a day as read (idempotent). Optionally attach pages / a book. */
export async function markRead(
  date: string,
  opts: { pages?: number; bookId?: number } = {}
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reading_days (date, pages, book_id, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       pages   = COALESCE(excluded.pages, reading_days.pages),
       book_id = COALESCE(excluded.book_id, reading_days.book_id);`,
    [date, opts.pages ?? null, opts.bookId ?? null, new Date().toISOString()]
  );
}

/**
 * Overwrite the detail (pages / attributed book) on an already-marked day.
 * Unlike {@link markRead}, this replaces the stored values rather than only
 * filling blanks — it backs the Today inline editor where the user adjusts
 * pages or switches which book the reading counted toward. No-op if the day
 * isn't marked (the editor only appears once it is).
 */
export async function setReadingDayDetail(
  date: string,
  detail: { pages?: number | null; bookId?: number | null }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE reading_days
       SET pages   = COALESCE(?, pages),
           book_id = COALESCE(?, book_id)
     WHERE date = ?;`,
    [detail.pages ?? null, detail.bookId ?? null, date]
  );
}

/** Remove a day's read mark. */
export async function unmarkRead(date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM reading_days WHERE date = ?;', [date]);
}

/**
 * Seed a few weeks of demo reading so the streak UI has something to show while
 * developing. No-op once any reading exists, so it never clobbers real data.
 * Intended to be called only in development (see the app data provider).
 *
 * Produces a live 2-week streak (two past weeks at 5/5) plus the current week
 * filled up to — but not including — today, so "I read today" stays tappable.
 */
export async function seedDemoDataIfEmpty(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM reading_days;');
  if ((row?.c ?? 0) > 0) return;

  await updateSettings({ weeklyTarget: 5 });

  const thisMonday = mondayOf(todayISO());

  // Two completed past weeks (Mon–Fri = 5 days each).
  for (const weekOffset of [-14, -7]) {
    const monday = addDays(thisMonday, weekOffset);
    for (let day = 0; day < 5; day++) {
      await markRead(addDays(monday, day), { pages: 30 });
    }
  }

  // Current week: mark the days before today, leaving today open to tap.
  const todayIndex = weekdayIndex(todayISO()); // 0 = Monday
  for (let day = 0; day < todayIndex; day++) {
    await markRead(addDays(thisMonday, day), { pages: 30 });
  }
}
