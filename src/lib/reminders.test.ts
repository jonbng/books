/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReminderSchedule } from './reminders.ts';

// A fixed "now" well before the reminder time so the day-0 rung is in the future.
const NOW = new Date(2026, 5, 23, 9, 0, 0, 0); // 2026-06-23 09:00 local

function build(overrides: Partial<Parameters<typeof buildReminderSchedule>[0]> = {}) {
  return buildReminderSchedule({
    now: NOW,
    hour: 20,
    minute: 0,
    readToday: false,
    hasActiveStreak: false,
    ...overrides,
  });
}

test('lays a decaying ladder that stays under the OS cap', () => {
  const schedule = build();
  // 25 offsets, all in the future from 09:00 → all kept.
  assert.equal(schedule.length, 25);
  assert.ok(schedule.length < 64, 'must stay under the iOS pending-notification cap');
});

test('rungs are strictly increasing in time with widening gaps', () => {
  const times = build().map((r) => r.fireAt.getTime());
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] > times[i - 1], 'each rung is later than the last');
  }
  // First gap (day 0→1) is one day; a late gap (monthly) is far larger.
  const day = 24 * 60 * 60 * 1000;
  assert.equal(times[1] - times[0], day);
  assert.ok(times[times.length - 1] - times[times.length - 2] >= 29 * day);
});

test('phases progress active → cooling → dormant', () => {
  const schedule = build();
  assert.equal(schedule[0].phase, 'active'); // day 0
  assert.equal(schedule[7].phase, 'active'); // day 7
  assert.equal(schedule[8].phase, 'cooling'); // day 11
  assert.equal(schedule.at(-1)?.phase, 'dormant'); // day 360
});

test('readToday drops the day-0 rung (no nag after reading)', () => {
  const withRead = build({ readToday: true });
  const without = build({ readToday: false });
  assert.equal(withRead.length, without.length - 1);
  // First remaining rung is now tomorrow at 20:00.
  assert.equal(withRead[0].fireAt.getDate(), 24);
});

test('rungs already in the past are filtered out', () => {
  // now is 22:00, after the 20:00 reminder time → today's rung is in the past.
  const late = build({ now: new Date(2026, 5, 23, 22, 0, 0, 0) });
  assert.equal(late.length, 24); // day-0 dropped as past
  assert.equal(late[0].fireAt.getDate(), 24); // starts tomorrow
});

test('active phase uses streak-aware copy when a streak is live', () => {
  const streak = build({ hasActiveStreak: true });
  const plain = build({ hasActiveStreak: false });
  assert.match(streak[0].title, /streak|chain/i);
  assert.doesNotMatch(plain[0].title, /streak|chain/i);
  // Cooling/dormant copy is unaffected by streak state.
  assert.equal(streak[8].title, plain[8].title);
});
