/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isbn10To13, isValidIsbn, isValidIsbn10, isValidIsbn13, normalizeIsbn } from './isbn.ts';

test('normalizeIsbn strips separators and upper-cases X', () => {
  assert.equal(normalizeIsbn('978-0-306-40615-7'), '9780306406157');
  assert.equal(normalizeIsbn('0 8044 2957 x'), '080442957X');
});

test('isValidIsbn13 — canonical Wikipedia example', () => {
  assert.equal(isValidIsbn13('9780306406157'), true);
  assert.equal(isValidIsbn13('978-0-306-40615-7'), true); // separators tolerated
  assert.equal(isValidIsbn13('9780306406158'), false); // bad check digit
  assert.equal(isValidIsbn13('978030640615'), false); // too short
});

test('isValidIsbn10 — including the X check digit', () => {
  assert.equal(isValidIsbn10('0306406152'), true);
  assert.equal(isValidIsbn10('080442957X'), true);
  assert.equal(isValidIsbn10('0306406153'), false); // bad check digit
  assert.equal(isValidIsbn10('030640615'), false); // too short
});

test('isValidIsbn accepts either length, rejects junk', () => {
  assert.equal(isValidIsbn('9780306406157'), true);
  assert.equal(isValidIsbn('0306406152'), true);
  assert.equal(isValidIsbn('12345'), false);
  assert.equal(isValidIsbn(''), false);
});

test('isbn10To13 converts and computes the new check digit', () => {
  assert.equal(isbn10To13('0306406152'), '9780306406157');
  assert.equal(isbn10To13('not-an-isbn'), null);
});
