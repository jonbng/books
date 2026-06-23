/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeStreak } from './streak.ts';
import { buildWidgetSnapshot, widgetBookFrom } from './widget-snapshot.ts';

// 2026-06-22 is a Monday; 06-24 Wed, 06-28 Sun.
const MON = '2026-06-22';
const WED = '2026-06-24';

function snapshotFor(opts: {
  readingDays: string[];
  weeklyTarget: number;
  today: string;
  frozenWeeks?: string[];
  availableFreezes?: number;
  yearlyGoal?: number | null;
  booksFinishedThisYear?: number;
  book?: Parameters<typeof buildWidgetSnapshot>[0]['book'];
}) {
  const streak = computeStreak({
    readingDays: opts.readingDays,
    weeklyTarget: opts.weeklyTarget,
    frozenWeeks: opts.frozenWeeks,
    today: opts.today,
  });
  return buildWidgetSnapshot({
    today: opts.today,
    streak,
    weeklyTarget: opts.weeklyTarget,
    availableFreezes: opts.availableFreezes ?? 0,
    yearlyGoal: opts.yearlyGoal ?? null,
    booksFinishedThisYear: opts.booksFinishedThisYear ?? 0,
    book: opts.book ?? null,
  });
}

test('weekDots is 7 booleans Mon..Sun reflecting read days', () => {
  const snap = snapshotFor({
    readingDays: [MON, WED], // Mon + Wed
    weeklyTarget: 5,
    today: WED,
  });
  assert.equal(snap.weekDots.length, 7);
  assert.deepEqual(snap.weekDots, [true, false, true, false, false, false, false]);
  assert.equal(snap.daysRead, 2);
});

test('readToday and today reflect the current day', () => {
  const read = snapshotFor({ readingDays: [MON, WED], weeklyTarget: 5, today: WED });
  assert.equal(read.readToday, true);
  assert.equal(read.today, WED);

  const notRead = snapshotFor({ readingDays: [MON], weeklyTarget: 5, today: WED });
  assert.equal(notRead.readToday, false);
});

test('status is in-progress before target, complete after', () => {
  const partial = snapshotFor({
    readingDays: ['2026-06-22', '2026-06-23'],
    weeklyTarget: 5,
    today: '2026-06-23',
  });
  assert.equal(partial.status, 'in-progress');

  const hit = snapshotFor({
    readingDays: ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26'],
    weeklyTarget: 5,
    today: '2026-06-26',
  });
  assert.equal(hit.status, 'complete');
});

test('a frozen current week reports frozen status', () => {
  const snap = snapshotFor({
    readingDays: [],
    weeklyTarget: 5,
    today: WED,
    frozenWeeks: [MON],
  });
  assert.equal(snap.status, 'frozen');
});

test('week streak carries through from past complete weeks', () => {
  // Two prior full weeks (Mon–Fri ×2) + current week with one day.
  const prior = [
    '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', // week of 06-08
    '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', // week of 06-15
  ];
  const snap = snapshotFor({
    readingDays: [...prior, MON],
    weeklyTarget: 5,
    today: MON,
  });
  assert.equal(snap.weekStreak, 2); // current in-progress week doesn't add yet
  assert.equal(snap.weeklyTarget, 5);
});

test('no current book yields book: null', () => {
  const snap = snapshotFor({ readingDays: [MON], weeklyTarget: 5, today: MON });
  assert.equal(snap.book, null);
});

test('availableFreezes is carried through for the large size', () => {
  const snap = snapshotFor({ readingDays: [MON], weeklyTarget: 5, today: MON, availableFreezes: 2 });
  assert.equal(snap.availableFreezes, 2);
});

test('delight fields (longest streak, yearly goal) are carried through', () => {
  const snap = snapshotFor({
    readingDays: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', MON],
    weeklyTarget: 5,
    today: MON,
    yearlyGoal: 30,
    booksFinishedThisYear: 12,
  });
  assert.ok(snap.longestStreak >= snap.weekStreak); // longest is never below current
  assert.equal(snap.yearlyGoal, 30);
  assert.equal(snap.booksFinishedThisYear, 12);
});

test('book percent comes from page progress', () => {
  const snap = snapshotFor({
    readingDays: [MON],
    weeklyTarget: 5,
    today: MON,
    book: widgetBookFrom(
      { id: 7, title: 'Atomic Habits', currentPage: 95, totalPages: 250 },
      '/data/widget-cover-7.jpg'
    ),
  });
  assert.deepEqual(snap.book, {
    id: 7,
    title: 'Atomic Habits',
    percent: 38, // round(95/250*100)
    coverPath: '/data/widget-cover-7.jpg',
  });
});

test('widgetBookFrom tolerates unknown total pages', () => {
  const book = widgetBookFrom(
    { id: 1, title: 'Untitled', currentPage: 10, totalPages: null },
    null
  );
  assert.equal(book.percent, 0);
  assert.equal(book.coverPath, null);
});
