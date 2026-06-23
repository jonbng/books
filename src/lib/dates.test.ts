/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatLongDate, formatWeekdayDate } from './dates.ts';

test('formatLongDate renders a human label from an ISO date', () => {
  assert.equal(formatLongDate('2026-06-23'), 'June 23, 2026');
  assert.equal(formatLongDate('2025-01-01'), 'January 1, 2025');
  assert.equal(formatLongDate('2024-12-31'), 'December 31, 2024');
});

test('formatLongDate accepts a full timestamp and ignores the time', () => {
  assert.equal(formatLongDate('2026-06-23T22:15:00.000Z'), 'June 23, 2026');
});

test('formatWeekdayDate renders weekday, month and day', () => {
  // 2026-06-23 is a Tuesday.
  assert.equal(formatWeekdayDate('2026-06-23'), 'Tuesday, June 23');
  // 2026-06-22 is a Monday (week start).
  assert.equal(formatWeekdayDate('2026-06-22'), 'Monday, June 22');
  // 2025-01-01 is a Wednesday.
  assert.equal(formatWeekdayDate('2025-01-01'), 'Wednesday, January 1');
});

test('formatWeekdayDate accepts a full timestamp and ignores the time', () => {
  assert.equal(formatWeekdayDate('2026-06-23T22:15:00.000Z'), 'Tuesday, June 23');
});
