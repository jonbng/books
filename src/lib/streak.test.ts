/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, mondayOf, weekDates, weekdayIndex, weeksBetween } from './dates.ts';
import { computeStreak, type StreakInput } from './streak.ts';

// --- date helpers -----------------------------------------------------------

test('mondayOf snaps any day to its Monday', () => {
  // 2026-06-22 is a Monday.
  assert.equal(mondayOf('2026-06-22'), '2026-06-22');
  assert.equal(mondayOf('2026-06-24'), '2026-06-22'); // Wednesday
  assert.equal(mondayOf('2026-06-28'), '2026-06-22'); // Sunday (same week)
  assert.equal(mondayOf('2026-06-29'), '2026-06-29'); // next Monday
});

test('weekdayIndex has Monday=0 .. Sunday=6', () => {
  assert.equal(weekdayIndex('2026-06-22'), 0); // Mon
  assert.equal(weekdayIndex('2026-06-28'), 6); // Sun
});

test('weekDates returns Mon..Sun', () => {
  assert.deepEqual(weekDates('2026-06-22'), [
    '2026-06-22',
    '2026-06-23',
    '2026-06-24',
    '2026-06-25',
    '2026-06-26',
    '2026-06-27',
    '2026-06-28',
  ]);
});

test('addDays crosses month/year boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('weeksBetween counts whole weeks', () => {
  assert.equal(weeksBetween('2026-06-01', '2026-06-22'), 3);
});

// --- streak engine ----------------------------------------------------------

/** Mark every day Mon..(Mon+n-1) of the given week as read. */
function readFirstNDays(monday: string, n: number): string[] {
  return weekDates(monday).slice(0, n);
}

const MON = '2026-06-22'; // current week's Monday in these tests
const TODAY = '2026-06-24'; // Wednesday

test('no activity → empty streak, in-progress current week', () => {
  const r = computeStreak({ readingDays: [], weeklyTarget: 4, today: TODAY });
  assert.equal(r.weekStreak, 0);
  assert.equal(r.longestStreak, 0);
  assert.equal(r.readToday, false);
  assert.equal(r.currentWeek.status, 'in-progress');
  assert.equal(r.currentWeek.daysRead, 0);
});

test('readToday reflects whether today is marked', () => {
  const r = computeStreak({ readingDays: [TODAY], weeklyTarget: 4, today: TODAY });
  assert.equal(r.readToday, true);
  assert.equal(r.currentWeek.daysRead, 1);
  assert.deepEqual(r.currentWeek.readDays, [TODAY]);
});

test('current week stays in-progress until target is hit, without breaking streak', () => {
  // Previous week complete (4/4), current week only 2 days so far (target 4).
  const prevMon = addDays(MON, -7);
  const input: StreakInput = {
    readingDays: [...readFirstNDays(prevMon, 4), MON, addDays(MON, 1)],
    weeklyTarget: 4,
    today: TODAY,
  };
  const r = computeStreak(input);
  assert.equal(r.currentWeek.status, 'in-progress');
  // Streak is alive from last week even though this week isn't done.
  assert.equal(r.weekStreak, 1);
});

test('hitting target this week counts the current week', () => {
  const prevMon = addDays(MON, -7);
  const input: StreakInput = {
    readingDays: [...readFirstNDays(prevMon, 4), ...readFirstNDays(MON, 4)],
    weeklyTarget: 4,
    today: TODAY,
  };
  const r = computeStreak(input);
  assert.equal(r.currentWeek.status, 'complete');
  assert.equal(r.weekStreak, 2);
});

test('a missed past week breaks the streak', () => {
  // Three weeks ago: complete. Two weeks ago: missed (1 day). Last week: complete.
  const w3 = addDays(MON, -21);
  const w2 = addDays(MON, -14);
  const w1 = addDays(MON, -7);
  const input: StreakInput = {
    readingDays: [
      ...readFirstNDays(w3, 5),
      ...readFirstNDays(w2, 1), // missed
      ...readFirstNDays(w1, 5),
      ...readFirstNDays(MON, 5),
    ],
    weeklyTarget: 5,
    today: TODAY,
  };
  const r = computeStreak(input);
  // Current streak only counts last week + this week.
  assert.equal(r.weekStreak, 2);
  // Longest run historically was also 2 (w1+current) or the single w3 → 2.
  assert.equal(r.longestStreak, 2);
});

test('a frozen week preserves the streak even with zero reading', () => {
  const w2 = addDays(MON, -14);
  const w1 = addDays(MON, -7);
  const input: StreakInput = {
    readingDays: [
      ...readFirstNDays(w2, 4),
      // w1: read nothing, but it's frozen
      ...readFirstNDays(MON, 4),
    ],
    weeklyTarget: 4,
    frozenWeeks: [w1],
    today: TODAY,
  };
  const r = computeStreak(input);
  const frozen = r.weeks.find((w) => w.monday === w1);
  assert.equal(frozen?.status, 'frozen');
  assert.equal(r.weekStreak, 3); // w2 + frozen w1 + current
});

test('weekly target of 7 requires every day', () => {
  const input: StreakInput = {
    readingDays: readFirstNDays(MON, 6),
    weeklyTarget: 7,
    today: addDays(MON, 6), // Sunday
  };
  const r = computeStreak(input);
  assert.equal(r.currentWeek.status, 'in-progress'); // only 6/7
  assert.equal(r.weekStreak, 0);
});

test('longestStreak captures a past run longer than the current one', () => {
  // Weeks -4..-1 all complete (run of 4), then current week missed-so-far.
  const reads: string[] = [];
  for (let i = 4; i >= 1; i--) reads.push(...readFirstNDays(addDays(MON, -7 * i), 4));
  const r = computeStreak({ readingDays: reads, weeklyTarget: 4, today: TODAY });
  assert.equal(r.longestStreak, 4);
  assert.equal(r.weekStreak, 4); // still alive (current in-progress doesn't break it)
});

test('duplicate read entries are ignored', () => {
  const r = computeStreak({
    readingDays: [TODAY, TODAY, TODAY],
    weeklyTarget: 4,
    today: TODAY,
  });
  assert.equal(r.currentWeek.daysRead, 1);
});
