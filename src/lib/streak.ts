/**
 * The streak engine — pure, dependency-free logic for the forgiving, week-based
 * streak model described in DESIGN.md §4.
 *
 * Key ideas:
 *  - The streak unit is the WEEK, not the day.
 *  - A week is "kept" if you hit your weekly target (4–7 days) OR you froze it.
 *  - The current (in-progress) week never *breaks* the streak; it only *adds* to
 *    the count once it's actually complete or frozen.
 *
 * Everything here is a pure function of its inputs (no Date.now, no I/O) so it is
 * fully unit-testable and deterministic — `today` is always passed in.
 */

import { mondayOf, mondaysInRange, weekDates } from './dates.ts';

/** A week is the streak unit; this is its standing. */
export type WeekStatus =
  | 'complete' // hit the weekly target
  | 'frozen' // a freeze was applied to protect this week
  | 'in-progress' // the current week, target not yet reached
  | 'missed'; // a past week where the target was not met and no freeze applied

export interface WeekSummary {
  /** The Monday that starts this week, as an ISO date. */
  monday: string;
  /** Weekly target in effect (days/week). */
  target: number;
  /** Which of this week's days were read, as ISO dates (ascending). */
  readDays: string[];
  /** Count of days read this week (`readDays.length`). */
  daysRead: number;
  status: WeekStatus;
}

export interface StreakInput {
  /** ISO dates the user marked "I read today". Order doesn't matter; dupes ignored. */
  readingDays: string[];
  /** Weekly goal: 4, 5, 6, or 7 days/week. */
  weeklyTarget: number;
  /** ISO Mondays of weeks the user has frozen. */
  frozenWeeks?: string[];
  /** The current day, as an ISO date `YYYY-MM-DD`. */
  today: string;
}

export interface StreakResult {
  /** Current week-streak length ("8 weeks strong"). */
  weekStreak: number;
  /** Longest week-streak ever achieved (for stats). */
  longestStreak: number;
  /** Summary of the current (this-week) frame, incl. the 7-dot row data. */
  currentWeek: WeekSummary;
  /** Whether today is already marked as read. */
  readToday: boolean;
  /** All weeks from first activity → current week, ascending (handy for stats/heatmap). */
  weeks: WeekSummary[];
}

/** A kept week is one that counts toward / preserves a streak. */
function isKept(status: WeekStatus): boolean {
  return status === 'complete' || status === 'frozen';
}

/** Build the summary for a single week. */
function summarizeWeek(
  monday: string,
  read: Set<string>,
  frozen: Set<string>,
  target: number,
  currentMonday: string
): WeekSummary {
  const readDays = weekDates(monday).filter((d) => read.has(d));
  const daysRead = readDays.length;

  let status: WeekStatus;
  if (frozen.has(monday)) {
    status = 'frozen';
  } else if (daysRead >= target) {
    status = 'complete';
  } else if (monday === currentMonday) {
    status = 'in-progress';
  } else {
    status = 'missed';
  }

  return { monday, target, readDays, daysRead, status };
}

/**
 * Compute the full streak state from the reading log.
 */
export function computeStreak(input: StreakInput): StreakResult {
  const { weeklyTarget, today } = input;
  const read = new Set(input.readingDays);
  const frozen = new Set(input.frozenWeeks ?? []);

  const currentMonday = mondayOf(today);

  // Earliest week we care about: the first week that has activity (a read day or
  // a freeze), or the current week if there's been none yet.
  const activityMondays = [
    ...[...read].map(mondayOf),
    ...[...frozen],
    currentMonday,
  ];
  const firstMonday = activityMondays.reduce((a, b) => (a < b ? a : b), currentMonday);

  const weeks = mondaysInRange(firstMonday, currentMonday).map((monday) =>
    summarizeWeek(monday, read, frozen, weeklyTarget, currentMonday)
  );

  // Current week streak: walk backwards from the current week.
  // The current week, while in-progress, doesn't add to the count but also
  // doesn't break the streak — we keep walking into past weeks.
  let weekStreak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (isKept(w.status)) {
      weekStreak++;
    } else if (w.status === 'in-progress') {
      // alive but not yet counted — look further back
      continue;
    } else {
      break; // a missed week ends the streak
    }
  }

  // Longest streak: longest run of kept weeks across all history. An in-progress
  // current week neither extends nor breaks a historical run.
  let longestStreak = 0;
  let run = 0;
  for (const w of weeks) {
    if (isKept(w.status)) {
      run++;
      longestStreak = Math.max(longestStreak, run);
    } else if (w.status === 'in-progress') {
      // don't reset; the week simply isn't finished
    } else {
      run = 0;
    }
  }
  // The live streak can exceed any completed historical run (it includes the
  // current week once kept), so account for it too.
  longestStreak = Math.max(longestStreak, weekStreak);

  const currentWeek = weeks[weeks.length - 1];

  return {
    weekStreak,
    longestStreak,
    currentWeek,
    readToday: read.has(today),
    weeks,
  };
}
