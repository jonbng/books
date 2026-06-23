/**
 * Stats & insights (DESIGN.md §9) — pure aggregations over the reading log and
 * the user's books. No I/O; the app data provider feeds it already-loaded rows.
 */

import type { Shelf } from './books.ts';
import { yearOf } from './dates.ts';

export interface StatsReadingDay {
  date: string;
  pages: number | null;
}

export interface StatsBook {
  shelf: Shelf;
  finishedAt: string | null;
}

export interface StatsInput {
  readingDays: StatsReadingDay[];
  books: StatsBook[];
  /** Today, 'YYYY-MM-DD' — used to scope "this year". */
  today: string;
  /** Optional yearly book-count goal. */
  yearlyGoal: number | null;
}

export interface Stats {
  /** Total days ever marked read. */
  totalReadingDays: number;
  /** Sum of recorded pages across all days. */
  totalPages: number;
  /** Average pages on days where pages were recorded (reading pace). */
  averagePagesPerReadingDay: number;
  /** Books on the Finished shelf. */
  booksFinished: number;
  /** Books currently on the Reading shelf. */
  currentlyReading: number;
  /** Reading days that fall in the current calendar year. */
  readingDaysThisYear: number;
  /** Pages recorded in the current calendar year. */
  pagesThisYear: number;
  /** Books finished in the current calendar year. */
  booksFinishedThisYear: number;
  yearlyGoal: number | null;
  /** Progress toward the yearly goal, 0–1 (0 when no goal set). */
  yearlyGoalProgress: number;
  /** date → intensity, for the calendar heatmap (pages, or 1 when none recorded). */
  heatmap: Record<string, number>;
  /** Chronological pages-per-day series for the "pages over time" chart. */
  pagesByDay: { date: string; pages: number }[];
}

export function computeStats(input: StatsInput): Stats {
  const { readingDays, books, today, yearlyGoal } = input;
  const thisYear = yearOf(today);

  let totalPages = 0;
  let pagesThisYear = 0;
  let readingDaysThisYear = 0;
  let daysWithPages = 0;
  const heatmap: Record<string, number> = {};
  const pagesByDay: { date: string; pages: number }[] = [];

  for (const day of readingDays) {
    const pages = day.pages ?? 0;
    totalPages += pages;
    if (day.pages != null) daysWithPages++;

    heatmap[day.date] = day.pages ?? 1;
    pagesByDay.push({ date: day.date, pages });

    if (yearOf(day.date) === thisYear) {
      readingDaysThisYear++;
      pagesThisYear += pages;
    }
  }

  pagesByDay.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let booksFinished = 0;
  let booksFinishedThisYear = 0;
  let currentlyReading = 0;

  for (const book of books) {
    if (book.shelf === 'finished') {
      booksFinished++;
      if (book.finishedAt && yearOf(book.finishedAt) === thisYear) {
        booksFinishedThisYear++;
      }
    } else if (book.shelf === 'reading') {
      currentlyReading++;
    }
  }

  const averagePagesPerReadingDay =
    daysWithPages > 0 ? Math.round(totalPages / daysWithPages) : 0;

  const yearlyGoalProgress =
    yearlyGoal && yearlyGoal > 0 ? Math.min(1, booksFinishedThisYear / yearlyGoal) : 0;

  return {
    totalReadingDays: readingDays.length,
    totalPages,
    averagePagesPerReadingDay,
    booksFinished,
    currentlyReading,
    readingDaysThisYear,
    pagesThisYear,
    booksFinishedThisYear,
    yearlyGoal,
    yearlyGoalProgress,
    heatmap,
    pagesByDay,
  };
}
