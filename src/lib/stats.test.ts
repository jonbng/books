/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeStats, type StatsInput } from './stats.ts';

const BASE: StatsInput = {
  today: '2026-06-22',
  yearlyGoal: null,
  readingDays: [
    { date: '2025-12-30', pages: 40 }, // last year
    { date: '2026-01-02', pages: 20 },
    { date: '2026-06-20', pages: null }, // counted day, no pages
    { date: '2026-06-21', pages: 60 },
  ],
  books: [
    { shelf: 'finished', finishedAt: '2026-03-01' },
    { shelf: 'finished', finishedAt: '2025-11-01' },
    { shelf: 'reading', finishedAt: null },
    { shelf: 'want_to_read', finishedAt: null },
  ],
};

test('aggregates totals and pace', () => {
  const s = computeStats(BASE);
  assert.equal(s.totalReadingDays, 4);
  assert.equal(s.totalPages, 120);
  // pace averages only days with recorded pages: (40+20+60)/3 = 40
  assert.equal(s.averagePagesPerReadingDay, 40);
});

test('scopes "this year" correctly', () => {
  const s = computeStats(BASE);
  assert.equal(s.readingDaysThisYear, 3); // 2026 days
  assert.equal(s.pagesThisYear, 80); // 20 + 0 + 60
  assert.equal(s.booksFinished, 2);
  assert.equal(s.booksFinishedThisYear, 1); // only 2026-03-01
  assert.equal(s.currentlyReading, 1);
});

test('heatmap uses pages, falling back to 1 for page-less days', () => {
  const s = computeStats(BASE);
  assert.equal(s.heatmap['2026-06-21'], 60);
  assert.equal(s.heatmap['2026-06-20'], 1);
});

test('pagesByDay is chronological', () => {
  const s = computeStats(BASE);
  assert.deepEqual(
    s.pagesByDay.map((d) => d.date),
    ['2025-12-30', '2026-01-02', '2026-06-20', '2026-06-21']
  );
});

test('yearly goal progress', () => {
  const withGoal = computeStats({ ...BASE, yearlyGoal: 4 });
  assert.equal(withGoal.yearlyGoalProgress, 0.25); // 1 of 4 finished this year
  const noGoal = computeStats({ ...BASE, yearlyGoal: null });
  assert.equal(noGoal.yearlyGoalProgress, 0);
});

test('empty input is safe', () => {
  const s = computeStats({ today: '2026-06-22', yearlyGoal: 10, readingDays: [], books: [] });
  assert.equal(s.totalReadingDays, 0);
  assert.equal(s.averagePagesPerReadingDay, 0);
  assert.equal(s.yearlyGoalProgress, 0);
});
