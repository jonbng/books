/**
 * Pure book helpers — progress math for the per-cover progress bar (DESIGN.md §6, §10).
 */

import { daysBetween } from './dates.ts';

export type Shelf = 'want_to_read' | 'reading' | 'finished';

export const SHELVES: Shelf[] = ['reading', 'want_to_read', 'finished'];

export const SHELF_LABELS: Record<Shelf, string> = {
  reading: 'Reading',
  want_to_read: 'Want to Read',
  finished: 'Finished',
};

/**
 * Reading progress as a fraction in [0, 1]. Returns 0 when the total page count
 * is unknown, so callers can always render a (possibly empty) bar.
 */
export function readingProgress(currentPage: number, totalPages: number | null): number {
  if (!totalPages || totalPages <= 0) return 0;
  return Math.max(0, Math.min(1, currentPage / totalPages));
}

/** Progress as a whole-number percentage (0–100). */
export function readingPercent(currentPage: number, totalPages: number | null): number {
  return Math.round(readingProgress(currentPage, totalPages) * 100);
}

/** A book counts as "complete by pages" when it's reached its last page. */
export function isOnLastPage(currentPage: number, totalPages: number | null): boolean {
  return totalPages != null && totalPages > 0 && currentPage >= totalPages;
}

/**
 * Calendar days spent on a finished book, counting both the start and finish
 * days (so finishing the same day it was started reads as "1 day"). Returns null
 * when either timestamp is missing, or when the dates are inverted (bad data).
 * Accepts full ISO timestamps — only the date portion matters.
 */
export function daysToFinish(
  startedAt: string | null,
  finishedAt: string | null
): number | null {
  if (!startedAt || !finishedAt) return null;
  const gap = daysBetween(startedAt.slice(0, 10), finishedAt.slice(0, 10));
  if (gap < 0) return null;
  return gap + 1;
}

/**
 * 1-based day a book has been in progress, for the "Day 4 of …" framing on
 * Today (DESIGN-UI.md §6 #4). Day 1 = started today; never below 1 (a future
 * or same-day start still reads as Day 1). Null when the start is unknown.
 */
export function dayOfReading(startedAt: string | null, today: string): number | null {
  if (!startedAt) return null;
  return Math.max(1, daysBetween(startedAt.slice(0, 10), today.slice(0, 10)) + 1);
}
