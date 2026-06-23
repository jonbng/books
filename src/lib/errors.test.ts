/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isNetworkError, toUserMessage } from './errors.ts';

test('isNetworkError — fetch failures look like TypeErrors', () => {
  assert.equal(isNetworkError(new TypeError('Network request failed')), true);
  assert.equal(isNetworkError(new Error('Failed to fetch')), true);
  assert.equal(isNetworkError(new Error('network error')), true);
});

test('isNetworkError — HTTP and other errors are not network errors', () => {
  assert.equal(isNetworkError(new Error('Open Library search failed: 503')), false);
  assert.equal(isNetworkError(new Error('Failed to insert book')), false);
  assert.equal(isNetworkError('just a string'), false);
  assert.equal(isNetworkError(null), false);
});

test('toUserMessage — offline errors get the connection line', () => {
  const msg = toUserMessage(new TypeError('Network request failed'), 'Search failed.');
  assert.match(msg, /connection/i);
});

test('toUserMessage — raw HTTP statuses are hidden behind the fallback', () => {
  assert.equal(
    toUserMessage(new Error('Open Library search failed: 503'), 'Search failed.'),
    'Search failed.'
  );
});

test('toUserMessage — author-written validation messages pass through', () => {
  assert.equal(
    toUserMessage(new Error('A reading session is already in progress'), 'Fallback.'),
    'A reading session is already in progress'
  );
});

test('toUserMessage — non-Error values fall back', () => {
  assert.equal(toUserMessage(undefined, 'Fallback.'), 'Fallback.');
  assert.equal(toUserMessage({ weird: true }, 'Fallback.'), 'Fallback.');
});

test('toUserMessage — default fallback when none given', () => {
  assert.match(toUserMessage(new Error('boom')), /went wrong/i);
});
