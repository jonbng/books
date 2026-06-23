/**
 * Pure helpers for timed reading sessions.
 *
 * No I/O and no `Date.now()` — callers pass timestamps in, so everything here is
 * deterministic and unit-testable (same discipline as streak.ts / stats.ts).
 * Session timestamps are full ISO strings; "this year" scoping uses the local
 * `session_date` (YYYY-MM-DD) via {@link yearOf}.
 */

import { yearOf } from './dates.ts';

/** Whole seconds between two ISO timestamps (clamped to >= 0). */
export function elapsedSeconds(startISO: string, nowISO: string): number {
  const start = new Date(startISO).getTime();
  const now = new Date(nowISO).getTime();
  return Math.max(0, Math.floor((now - start) / 1000));
}

/**
 * A running clock label: "0:45", "2:05", "1:02:05". Minutes always shown;
 * hours only once the session crosses an hour. Seconds/minutes zero-padded so
 * the digits don't reflow (pair with tabular-nums in the UI).
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * A compact stat-tile label: "45s", "10m", "1h 30m". Drops zero parts so it
 * reads cleanly in a small space (used on the Stats screen, not the live timer).
 */
export function formatDurationCompact(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** The shape {@link aggregateSessions} needs from each finished session. */
export interface SessionStat {
  sessionDate: string; // 'YYYY-MM-DD'
  durationSeconds: number | null;
  pages: number | null;
}

export interface SessionAggregates {
  /** Total time across all finished sessions, in seconds. */
  totalSeconds: number;
  /** Time spent in sessions dated this year, in seconds. */
  secondsThisYear: number;
  /** Number of finished sessions counted. */
  sessionCount: number;
  /** Mean duration over sessions that have a recorded duration (0 if none). */
  averageSessionSeconds: number;
  /** Total pages recorded across sessions. */
  pagesFromSessions: number;
}

/**
 * Aggregate finished sessions for the Stats screen. `today` (YYYY-MM-DD) scopes
 * the "this year" totals. Sessions without a duration are still counted toward
 * `sessionCount`/`pagesFromSessions` but excluded from the average so a missing
 * duration can't drag it to zero.
 */
export function aggregateSessions(
  sessions: SessionStat[],
  today: string
): SessionAggregates {
  const year = yearOf(today);
  let totalSeconds = 0;
  let secondsThisYear = 0;
  let pagesFromSessions = 0;
  let timedCount = 0;

  for (const s of sessions) {
    const duration = s.durationSeconds ?? 0;
    totalSeconds += duration;
    if (s.durationSeconds != null) timedCount += 1;
    if (yearOf(s.sessionDate) === year) secondsThisYear += duration;
    pagesFromSessions += s.pages ?? 0;
  }

  return {
    totalSeconds,
    secondsThisYear,
    sessionCount: sessions.length,
    averageSessionSeconds: timedCount === 0 ? 0 : Math.round(totalSeconds / timedCount),
    pagesFromSessions,
  };
}
