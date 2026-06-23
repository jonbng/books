/**
 * The Android home-screen widget's data contract.
 *
 * The widget process has no JS runtime and must not open the SQLite database, so
 * the app projects its already-computed "Today" state into a small, serialisable
 * snapshot (see the widget plan). This is a pure mapping over existing derived
 * state — no new domain rules — so it's fully unit-testable and can't drift from
 * what the in-app Today screen shows.
 */

import { readingPercent } from './books.ts';
import { weekDates } from './dates.ts';
import { type StreakResult, type WeekStatus } from './streak.ts';

/** Currently-reading book as the widget needs it (cover is a local file path). */
export interface WidgetBook {
  id: number;
  title: string;
  /** Reading progress 0–100. */
  percent: number;
  /** Absolute path to a downloaded cover bitmap, or null if none/unavailable. */
  coverPath: string | null;
}

/** Everything the medium 4×2 widget renders, derived from app state. */
export interface WidgetSnapshot {
  /** ISO `YYYY-MM-DD` the snapshot describes. */
  today: string;
  readToday: boolean;
  weekStreak: number;
  weeklyTarget: number;
  /** Days read so far this week (`currentWeek.daysRead`). */
  daysRead: number;
  status: WeekStatus;
  /** Seven booleans, Monday→Sunday, true where that day is marked read. */
  weekDots: boolean[];
  /** Freezes the user currently holds (shown on the large size). */
  availableFreezes: number;
  /** Longest week-streak ever — drives the "personal best" badge. */
  longestStreak: number;
  /** Yearly book-count goal, or null if unset (large size). */
  yearlyGoal: number | null;
  /** Books finished so far this calendar year (large size). */
  booksFinishedThisYear: number;
  book: WidgetBook | null;
}

export interface WidgetSnapshotInput {
  /** The current day, ISO `YYYY-MM-DD` (from `AppData.today`). */
  today: string;
  streak: StreakResult;
  weeklyTarget: number;
  availableFreezes: number;
  yearlyGoal: number | null;
  booksFinishedThisYear: number;
  /** First book on the "reading" shelf, already resolved with a cover path. */
  book: WidgetBook | null;
}

/**
 * Build the widget snapshot from the same derived state the Today screen uses.
 * `weekDots` is computed from `currentWeek.monday` + `currentWeek.readDays` — the
 * identical inputs `week-dots.tsx` renders — so widget and app can't disagree.
 */
export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const { today, streak, weeklyTarget, availableFreezes, yearlyGoal, booksFinishedThisYear, book } =
    input;
  const { currentWeek } = streak;

  const read = new Set(currentWeek.readDays);
  const weekDots = weekDates(currentWeek.monday).map((d) => read.has(d));

  return {
    today,
    readToday: streak.readToday,
    weekStreak: streak.weekStreak,
    weeklyTarget,
    daysRead: currentWeek.daysRead,
    status: currentWeek.status,
    weekDots,
    availableFreezes,
    longestStreak: streak.longestStreak,
    yearlyGoal,
    booksFinishedThisYear,
    book,
  };
}

/** Helper for callers turning a DB book into the widget shape. */
export function widgetBookFrom(
  book: { id: number; title: string; currentPage: number; totalPages: number | null },
  coverPath: string | null
): WidgetBook {
  return {
    id: book.id,
    title: book.title,
    percent: readingPercent(book.currentPage, book.totalPages),
    coverPath,
  };
}
