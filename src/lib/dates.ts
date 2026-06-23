/**
 * Pure date helpers for the streak engine.
 *
 * A "day" is represented as an ISO date string `YYYY-MM-DD` (no time, no zone).
 * All math is done in UTC so results never shift with the device timezone or DST.
 * The week starts on **Monday** (see DESIGN.md §4 "Week reset: Monday").
 */

/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Format a Date as a `YYYY-MM-DD` string using its UTC fields. */
export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` string into a Date anchored at UTC midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The local "today" as a `YYYY-MM-DD` string (uses the device's wall-clock date). */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Return a new ISO date `n` days after `iso` (n may be negative). */
export function addDays(iso: string, n: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + n * DAY_MS));
}

/** Day of week for an ISO date: 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  // getUTCDay: 0 = Sunday … 6 = Saturday. Rotate so Monday = 0.
  return (parseISODate(iso).getUTCDay() + 6) % 7;
}

/** The Monday (week start) of the week containing `iso`, as an ISO date. */
export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

/** The 7 ISO dates of a week, Monday → Sunday, given that week's Monday. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Whole days from `a` to `b` (b - a). Negative if `b` is before `a`. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS);
}

/** Whole weeks from Monday `a` to Monday `b`. Assumes both are Mondays. */
export function weeksBetween(a: string, b: string): number {
  return Math.round(daysBetween(a, b) / 7);
}

/** The 4-digit year of an ISO date (or any string starting `YYYY-`). */
export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Format an ISO date — or the date prefix of a full timestamp — as a human
 * label like "June 23, 2026". Done by hand (not `toLocaleDateString`) so it's
 * pure, timezone-stable, and reliable on Hermes' trimmed Intl.
 */
export function formatLongDate(iso: string): string {
  const date = parseISODate(iso.slice(0, 10));
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

const WEEKDAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/**
 * Format an ISO date as a weekday + month/day label like "Monday, June 23" —
 * the Today header line. Pure and Hermes-safe, same rationale as
 * {@link formatLongDate}.
 */
export function formatWeekdayDate(iso: string): string {
  const date = parseISODate(iso.slice(0, 10));
  return `${WEEKDAY_NAMES[weekdayIndex(iso.slice(0, 10))]}, ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** All week-start Mondays from `fromMonday` to `toMonday` inclusive, ascending. */
export function mondaysInRange(fromMonday: string, toMonday: string): string[] {
  const count = weeksBetween(fromMonday, toMonday);
  if (count < 0) return [];
  return Array.from({ length: count + 1 }, (_, i) => addDays(fromMonday, i * 7));
}
