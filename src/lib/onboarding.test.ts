/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { needsOnboarding } from './onboarding.ts';

test('needsOnboarding: false while settings are unknown (null)', () => {
  assert.equal(needsOnboarding(null), false);
});

test('needsOnboarding: true when settings loaded and flag unset', () => {
  assert.equal(needsOnboarding({ onboardingComplete: false }), true);
});

test('needsOnboarding: false once onboarding is complete', () => {
  assert.equal(needsOnboarding({ onboardingComplete: true }), false);
});
