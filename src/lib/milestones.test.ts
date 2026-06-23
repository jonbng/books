/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { streakMilestoneReached } from './milestones.ts';

test('fires when crossing a milestone', () => {
  assert.equal(streakMilestoneReached(1, 2), 2);
  assert.equal(streakMilestoneReached(7, 8), 8);
  assert.equal(streakMilestoneReached(25, 26), 26);
});

test('no fire between milestones or when not growing', () => {
  assert.equal(streakMilestoneReached(2, 3), null);
  assert.equal(streakMilestoneReached(8, 8), null);
  assert.equal(streakMilestoneReached(9, 5), null); // streak broke
});

test('a jump returns the highest milestone crossed', () => {
  assert.equal(streakMilestoneReached(1, 5), 4);
  assert.equal(streakMilestoneReached(0, 12), 12);
});
