/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  coverUrl,
  isbnToNewBook,
  mapIsbnResponse,
  mapRatings,
  mapSearchDoc,
  mapSearchResponse,
  mapTrendingResponse,
  mapWork,
  toNewBook,
} from './open-library.ts';

test('coverUrl builds a URL or returns null', () => {
  assert.equal(coverUrl(12345), 'https://covers.openlibrary.org/b/id/12345-L.jpg');
  assert.equal(coverUrl(12345, 'M'), 'https://covers.openlibrary.org/b/id/12345-M.jpg');
  assert.equal(coverUrl(null), null);
  assert.equal(coverUrl(undefined), null);
});

test('mapSearchDoc maps fields and derives the cover URL', () => {
  const result = mapSearchDoc({
    key: '/works/OL45804W',
    title: 'Fantastic Mr Fox',
    author_name: ['Roald Dahl', 'Someone Else'],
    cover_i: 6498519,
    first_publish_year: 1970,
    number_of_pages_median: 96,
    edition_count: 120,
  });
  assert.deepEqual(result, {
    key: '/works/OL45804W',
    title: 'Fantastic Mr Fox',
    author: 'Roald Dahl',
    coverId: 6498519,
    coverUrl: 'https://covers.openlibrary.org/b/id/6498519-L.jpg',
    firstPublishYear: 1970,
    pageCount: 96,
    editionCount: 120,
  });
});

test('mapSearchDoc returns null without a key or title', () => {
  assert.equal(mapSearchDoc({ title: 'No key' }), null);
  assert.equal(mapSearchDoc({ key: '/works/OL1W' }), null);
});

test('mapSearchResponse filters out unusable docs', () => {
  const results = mapSearchResponse({
    docs: [
      { key: '/works/OL1W', title: 'Good' },
      { title: 'No key — dropped' },
      { key: '/works/OL2W', title: 'Also good', author_name: ['A'] },
    ],
  });
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((r) => r.title),
    ['Good', 'Also good']
  );
});

test('mapSearchResponse tolerates a missing docs array', () => {
  assert.deepEqual(mapSearchResponse({}), []);
});

test('mapTrendingResponse maps the works array and drops unusable entries', () => {
  const results = mapTrendingResponse({
    works: [
      { key: '/works/OL17930368W', title: 'Atomic Habits', author_name: ['James Clear'] },
      { title: 'No key — dropped' },
    ],
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Atomic Habits');
  assert.equal(results[0].author, 'James Clear');
});

test('mapTrendingResponse tolerates a missing works array', () => {
  assert.deepEqual(mapTrendingResponse({}), []);
});

test('toNewBook shapes a result for the books repo', () => {
  const newBook = toNewBook(
    {
      key: '/works/OL45804W',
      title: 'Fantastic Mr Fox',
      author: 'Roald Dahl',
      coverId: 6498519,
      coverUrl: 'https://covers.openlibrary.org/b/id/6498519-L.jpg',
      firstPublishYear: 1970,
      pageCount: 96,
      editionCount: 120,
    },
    'reading'
  );
  assert.deepEqual(newBook, {
    openLibraryKey: '/works/OL45804W',
    title: 'Fantastic Mr Fox',
    author: 'Roald Dahl',
    coverUrl: 'https://covers.openlibrary.org/b/id/6498519-L.jpg',
    totalPages: 96,
    shelf: 'reading',
  });
});

// --- ISBN lookup ------------------------------------------------------------

const ISBN_RESPONSE = {
  'ISBN:9780140328721': {
    key: '/books/OL7353617M',
    title: 'Fantastic Mr Fox',
    authors: [{ name: 'Roald Dahl' }],
    number_of_pages: 96,
    cover: {
      small: 'https://covers.openlibrary.org/b/id/8739161-S.jpg',
      medium: 'https://covers.openlibrary.org/b/id/8739161-M.jpg',
      large: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
    },
  },
};

test('mapIsbnResponse pulls the entry keyed by ISBN and prefers the large cover', () => {
  const book = mapIsbnResponse(ISBN_RESPONSE, '9780140328721');
  assert.deepEqual(book, {
    isbn: '9780140328721',
    title: 'Fantastic Mr Fox',
    author: 'Roald Dahl',
    coverUrl: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
    pageCount: 96,
    openLibraryKey: '/books/OL7353617M',
  });
});

test('mapIsbnResponse returns null when the ISBN is absent', () => {
  assert.equal(mapIsbnResponse(ISBN_RESPONSE, '9999999999999'), null);
  assert.equal(mapIsbnResponse({}, '9780140328721'), null);
});

test('isbnToNewBook shapes an ISBN lookup for the books repo', () => {
  const book = mapIsbnResponse(ISBN_RESPONSE, '9780140328721')!;
  assert.deepEqual(isbnToNewBook(book, 'want_to_read'), {
    openLibraryKey: '/books/OL7353617M',
    title: 'Fantastic Mr Fox',
    author: 'Roald Dahl',
    coverUrl: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
    totalPages: 96,
    shelf: 'want_to_read',
  });
});

// --- Rich work details ------------------------------------------------------

test('mapWork reads a plain-string description and caps subjects', () => {
  const work = mapWork({
    description: '  A clever fox outwits three farmers.  ',
    subjects: Array.from({ length: 20 }, (_, i) => `Subject ${i}`),
    first_publish_date: '1970',
  });
  assert.equal(work.description, 'A clever fox outwits three farmers.');
  assert.equal(work.firstPublishYear, 1970);
  assert.equal(work.subjects.length, 12);
  assert.equal(work.subjects[0], 'Subject 0');
});

test('mapWork reads the {value} description form and a full date', () => {
  const work = mapWork({
    description: { value: 'Nested description.' },
    first_publish_date: 'September 1, 1988',
  });
  assert.equal(work.description, 'Nested description.');
  assert.equal(work.firstPublishYear, 1988);
});

test('mapWork tolerates missing fields', () => {
  assert.deepEqual(mapWork({}), {
    description: null,
    subjects: [],
    firstPublishYear: null,
  });
});

test('mapRatings keeps the average only when there are ratings', () => {
  assert.deepEqual(mapRatings({ summary: { average: 3.9572, count: 117 } }), {
    ratingAverage: 3.9572,
    ratingCount: 117,
  });
  assert.deepEqual(mapRatings({ summary: { average: null, count: 0 } }), {
    ratingAverage: null,
    ratingCount: 0,
  });
  assert.deepEqual(mapRatings({}), { ratingAverage: null, ratingCount: 0 });
});
