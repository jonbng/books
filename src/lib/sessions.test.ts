/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  aggregateSessions,
  elapsedSeconds,
  formatDuration,
  formatDurationCompact,
  type SessionStat,
} from './sessions.ts';

test('elapsedSeconds computes whole seconds and clamps negatives', () => {
  assert.equal(elapsedSeconds('2026-06-23T10:00:00.000Z', '2026-06-23T10:00:00.000Z'), 0);
  assert.equal(elapsedSeconds('2026-06-23T10:00:00.000Z', '2026-06-23T10:02:05.000Z'), 125);
  // sub-second rounds down
  assert.equal(elapsedSeconds('2026-06-23T10:00:00.000Z', '2026-06-23T10:00:00.900Z'), 0);
  // end before start clamps to 0
  assert.equal(elapsedSeconds('2026-06-23T10:00:00.000Z', '2026-06-23T09:59:00.000Z'), 0);
});

test('formatDuration shows m:ss under an hour and h:mm:ss above', () => {
  assert.equal(formatDuration(45), '0:45');
  assert.equal(formatDuration(125), '2:05');
  assert.equal(formatDuration(60), '1:00');
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(0), '0:00');
});

test('formatDurationCompact drops zero parts', () => {
  assert.equal(formatDurationCompact(0), '0s');
  assert.equal(formatDurationCompact(45), '45s');
  assert.equal(formatDurationCompact(600), '10m');
  assert.equal(formatDurationCompact(3600), '1h');
  assert.equal(formatDurationCompact(5400), '1h 30m');
});

const SESSIONS: SessionStat[] = [
  { sessionDate: '2025-12-31', durationSeconds: 600, pages: 10 }, // last year
  { sessionDate: '2026-01-05', durationSeconds: 1800, pages: 25 },
  { sessionDate: '2026-06-20', durationSeconds: 1200, pages: 0 },
  { sessionDate: '2026-06-21', durationSeconds: null, pages: 5 }, // no duration
];

test('aggregateSessions totals time, scopes year, and counts pages', () => {
  const a = aggregateSessions(SESSIONS, '2026-06-23');
  assert.equal(a.totalSeconds, 3600); // 600 + 1800 + 1200 + 0
  assert.equal(a.secondsThisYear, 3000); // 1800 + 1200 (2026 only)
  assert.equal(a.sessionCount, 4);
  assert.equal(a.pagesFromSessions, 40); // 10 + 25 + 0 + 5
  // average over the 3 timed sessions only: 3600 / 3 = 1200
  assert.equal(a.averageSessionSeconds, 1200);
});

test('aggregateSessions handles empty input without dividing by zero', () => {
  const a = aggregateSessions([], '2026-06-23');
  assert.deepEqual(a, {
    totalSeconds: 0,
    secondsThisYear: 0,
    sessionCount: 0,
    averageSessionSeconds: 0,
    pagesFromSessions: 0,
  });
});
