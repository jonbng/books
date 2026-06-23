/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  availableFreezes,
  freezesForStreak,
  reconcileFreezeCredit,
  selectAutoFreezeWeeks,
  type FreezeCreditState,
} from './freezes.ts';

test('freezesForStreak: 1 per 2 weeks', () => {
  assert.equal(freezesForStreak(0), 0);
  assert.equal(freezesForStreak(1), 0);
  assert.equal(freezesForStreak(2), 1);
  assert.equal(freezesForStreak(3), 1);
  assert.equal(freezesForStreak(8), 4);
});

test('reconcile credits a freeze when crossing a new even milestone', () => {
  const start: FreezeCreditState = { freezesEarned: 0, freezeCreditStreak: 0 };
  const at1 = reconcileFreezeCredit(start, 1);
  // credit tracks the highest streak seen; 1 earns nothing but advances credit.
  assert.deepEqual(at1, { freezesEarned: 0, freezeCreditStreak: 1 });
  const at2 = reconcileFreezeCredit(at1, 2);
  assert.deepEqual(at2, { freezesEarned: 1, freezeCreditStreak: 2 });
  const at3 = reconcileFreezeCredit(at2, 3);
  assert.deepEqual(at3, { freezesEarned: 1, freezeCreditStreak: 3 }); // odd, bumps credit only
  const at4 = reconcileFreezeCredit(at3, 4);
  assert.deepEqual(at4, { freezesEarned: 2, freezeCreditStreak: 4 });
});

test('reconcile is monotonic — a broken-then-regrown streak does not re-earn', () => {
  let state: FreezeCreditState = { freezesEarned: 2, freezeCreditStreak: 4 };
  // streak breaks to 0
  state = reconcileFreezeCredit(state, 0);
  assert.deepEqual(state, { freezesEarned: 2, freezeCreditStreak: 4 });
  // regrows back to 4 — no new freeze
  state = reconcileFreezeCredit(state, 4);
  assert.deepEqual(state, { freezesEarned: 2, freezeCreditStreak: 4 });
  // surpasses old max at 6 — earns one more (for the new milestone)
  state = reconcileFreezeCredit(state, 6);
  assert.deepEqual(state, { freezesEarned: 3, freezeCreditStreak: 6 });
});

test('availableFreezes nets used against earned and caps at the hold limit', () => {
  assert.equal(availableFreezes({ freezesEarned: 0, used: 0, maxFreezes: 3 }), 0);
  assert.equal(availableFreezes({ freezesEarned: 3, used: 1, maxFreezes: 3 }), 2);
  assert.equal(availableFreezes({ freezesEarned: 10, used: 0, maxFreezes: 3 }), 3); // capped
  assert.equal(availableFreezes({ freezesEarned: 1, used: 2, maxFreezes: 3 }), 0); // never negative
});

test('selectAutoFreezeWeeks: picks most-recent missed past weeks up to available', () => {
  const weeks = [
    { monday: '2026-05-04', status: 'complete' },
    { monday: '2026-05-11', status: 'missed' },
    { monday: '2026-05-18', status: 'missed' },
    { monday: '2026-05-25', status: 'in-progress' }, // current
  ];
  const picked = selectAutoFreezeWeeks({
    weeks,
    frozenWeeks: [],
    available: 1,
    currentMonday: '2026-05-25',
  });
  // Most recent missed past week first, current week excluded.
  assert.deepEqual(picked, ['2026-05-18']);
});

test('selectAutoFreezeWeeks: skips already-frozen and respects budget', () => {
  const weeks = [
    { monday: '2026-05-04', status: 'missed' },
    { monday: '2026-05-11', status: 'missed' },
    { monday: '2026-05-18', status: 'missed' },
    { monday: '2026-05-25', status: 'in-progress' },
  ];
  const picked = selectAutoFreezeWeeks({
    weeks,
    frozenWeeks: ['2026-05-18'],
    available: 5,
    currentMonday: '2026-05-25',
  });
  assert.deepEqual(picked, ['2026-05-11', '2026-05-04']);
});

test('selectAutoFreezeWeeks: nothing to do with no freezes', () => {
  const weeks = [{ monday: '2026-05-11', status: 'missed' }];
  assert.deepEqual(
    selectAutoFreezeWeeks({ weeks, frozenWeeks: [], available: 0, currentMonday: '2026-05-25' }),
    []
  );
});
