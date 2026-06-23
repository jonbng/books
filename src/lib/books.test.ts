/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dayOfReading,
  daysToFinish,
  isOnLastPage,
  readingPercent,
  readingProgress,
} from './books.ts';

test('readingProgress clamps and handles unknown totals', () => {
  assert.equal(readingProgress(0, null), 0);
  assert.equal(readingProgress(50, 100), 0.5);
  assert.equal(readingProgress(150, 100), 1);
  assert.equal(readingProgress(-10, 100), 0);
});

test('readingPercent rounds to a whole number', () => {
  assert.equal(readingPercent(33, 100), 33);
  assert.equal(readingPercent(1, 3), 33);
});

test('isOnLastPage needs a known total and the last page reached', () => {
  assert.equal(isOnLastPage(100, 100), true);
  assert.equal(isOnLastPage(99, 100), false);
  assert.equal(isOnLastPage(100, null), false);
});

test('daysToFinish counts both endpoints inclusively', () => {
  // Same day → 1 day.
  assert.equal(daysToFinish('2026-06-23T10:00:00Z', '2026-06-23T22:00:00Z'), 1);
  // Mon → Wed spans 3 calendar days.
  assert.equal(daysToFinish('2026-06-01', '2026-06-03'), 3);
  // A two-week read.
  assert.equal(daysToFinish('2026-06-01', '2026-06-14'), 14);
});

test('daysToFinish returns null for missing or inverted timestamps', () => {
  assert.equal(daysToFinish(null, '2026-06-03'), null);
  assert.equal(daysToFinish('2026-06-03', null), null);
  assert.equal(daysToFinish('2026-06-10', '2026-06-03'), null);
});

test('dayOfReading is 1-based from the start date', () => {
  // Started today → Day 1.
  assert.equal(dayOfReading('2026-06-23', '2026-06-23'), 1);
  // Started 3 days ago → Day 4.
  assert.equal(dayOfReading('2026-06-20', '2026-06-23'), 4);
  // Accepts full timestamps and ignores the time.
  assert.equal(dayOfReading('2026-06-20T08:00:00Z', '2026-06-23T22:00:00Z'), 4);
});

test('dayOfReading never drops below 1 and is null without a start', () => {
  // A future start still reads as Day 1, never 0 or negative.
  assert.equal(dayOfReading('2026-06-25', '2026-06-23'), 1);
  assert.equal(dayOfReading(null, '2026-06-23'), null);
});
