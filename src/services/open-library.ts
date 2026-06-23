/**
 * Open Library client (DESIGN.md §2) — book search, covers, and metadata.
 *
 * The network call is thin; the response→model mapping is a pure exported
 * function so it can be unit-tested with fixtures (no network).
 *
 * Docs: https://openlibrary.org/dev/docs/api/search
 *       https://openlibrary.org/dev/docs/api/covers
 *       https://openlibrary.org/dev/docs/api/books
 */

import type { NewBook } from '@/db/books-repo';
// Relative + .ts so this module (and its test) resolve under `node --test`,
// which doesn't understand the `@/` path alias for runtime imports.
import { isValidIsbn, normalizeIsbn } from '../lib/isbn.ts';

const OL_BASE = 'https://openlibrary.org';
const SEARCH_URL = `${OL_BASE}/search.json`;
const TRENDING_URL = `${OL_BASE}/trending`;
const COVERS_URL = 'https://covers.openlibrary.org/b/id';
const BOOKS_API_URL = `${OL_BASE}/api/books`;

/** Fields we ask Open Library for, keeping the payload small. */
const SEARCH_FIELDS = [
  'key',
  'title',
  'author_name',
  'cover_i',
  'first_publish_year',
  'number_of_pages_median',
  'edition_count',
].join(',');

export type CoverSize = 'S' | 'M' | 'L';

export interface BookSearchResult {
  /** Open Library work key, e.g. "/works/OL45804W". */
  key: string;
  title: string;
  author: string | null;
  coverId: number | null;
  coverUrl: string | null;
  firstPublishYear: number | null;
  pageCount: number | null;
  editionCount: number | null;
}

/** Raw shape of a single doc in the search response (only fields we request). */
interface SearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  edition_count?: number;
}

interface SearchResponse {
  docs?: SearchDoc[];
}

/** Build a cover image URL from a cover id. */
export function coverUrl(coverId: number | null | undefined, size: CoverSize = 'L'): string | null {
  if (coverId == null) return null;
  return `${COVERS_URL}/${coverId}-${size}.jpg`;
}

/** Map one raw search doc to our model. Pure — exported for testing. */
export function mapSearchDoc(doc: SearchDoc): BookSearchResult | null {
  if (!doc.key || !doc.title) return null;
  return {
    key: doc.key,
    title: doc.title,
    author: doc.author_name?.[0] ?? null,
    coverId: doc.cover_i ?? null,
    coverUrl: coverUrl(doc.cover_i),
    firstPublishYear: doc.first_publish_year ?? null,
    pageCount: doc.number_of_pages_median ?? null,
    editionCount: doc.edition_count ?? null,
  };
}

/** Map a full search response to a clean list. Pure — exported for testing. */
export function mapSearchResponse(json: SearchResponse): BookSearchResult[] {
  return (json.docs ?? [])
    .map(mapSearchDoc)
    .filter((r): r is BookSearchResult => r !== null);
}

/** Convert a search result into the shape `books-repo.addBook` expects. */
export function toNewBook(result: BookSearchResult, shelf?: NewBook['shelf']): NewBook {
  return {
    openLibraryKey: result.key,
    title: result.title,
    author: result.author,
    coverUrl: result.coverUrl,
    totalPages: result.pageCount,
    shelf,
  };
}

// --- Trending (popular books to surface before a search) --------------------
//
// The Trending API ranks works by recent reader activity. Each work carries the
// same fields a search doc does (just under `works` instead of `docs`), so the
// per-doc mapping is reused wholesale. Docs: https://openlibrary.org/trending

/** Time window for the trending ranking. */
export type TrendingRange = 'now' | 'daily' | 'weekly' | 'monthly' | 'yearly';

interface TrendingResponse {
  works?: SearchDoc[];
}

/** Map a trending response to a clean list. Pure — exported for testing. */
export function mapTrendingResponse(json: TrendingResponse): BookSearchResult[] {
  return (json.works ?? [])
    .map(mapSearchDoc)
    .filter((r): r is BookSearchResult => r !== null);
}

/** Fetch the books trending on Open Library over the given window. */
export async function fetchTrending(
  range: TrendingRange = 'weekly',
  limit = 15
): Promise<BookSearchResult[]> {
  const url = `${TRENDING_URL}/${range}.json?limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library trending failed: ${response.status}`);
  }
  const json = (await response.json()) as TrendingResponse;
  return mapTrendingResponse(json);
}

/** Search Open Library for books matching `query`. */
export async function searchBooks(query: string, limit = 20): Promise<BookSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${SEARCH_URL}?q=${encodeURIComponent(trimmed)}&fields=${SEARCH_FIELDS}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library search failed: ${response.status}`);
  }
  const json = (await response.json()) as SearchResponse;
  return mapSearchResponse(json);
}

// --- ISBN lookup (barcode scanning) -----------------------------------------

export interface IsbnBook {
  isbn: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  pageCount: number | null;
  /** Open Library edition key, e.g. "/books/OL7353617M". */
  openLibraryKey: string | null;
}

/** Raw entry shape from the Books API with `jscmd=data`. */
interface IsbnDataEntry {
  title?: string;
  authors?: { name?: string }[];
  number_of_pages?: number;
  cover?: { small?: string; medium?: string; large?: string };
  key?: string;
}

/** Map a Books-API response (keyed by `ISBN:<isbn>`) to our model. Pure — tested. */
export function mapIsbnResponse(
  json: Record<string, IsbnDataEntry>,
  isbn: string
): IsbnBook | null {
  const entry = json[`ISBN:${isbn}`];
  if (!entry || !entry.title) return null;
  return {
    isbn,
    title: entry.title,
    author: entry.authors?.[0]?.name ?? null,
    coverUrl: entry.cover?.large ?? entry.cover?.medium ?? entry.cover?.small ?? null,
    pageCount: entry.number_of_pages ?? null,
    openLibraryKey: entry.key ?? null,
  };
}

/** Convert an ISBN lookup into the shape `books-repo.addBook` expects. */
export function isbnToNewBook(book: IsbnBook, shelf?: NewBook['shelf']): NewBook {
  return {
    openLibraryKey: book.openLibraryKey,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    totalPages: book.pageCount,
    shelf,
  };
}

/**
 * Look up a single book by ISBN. Returns null for an invalid ISBN or when Open
 * Library has no record. Accepts ISBN-10 or ISBN-13, with or without separators.
 */
export async function lookupByIsbn(rawIsbn: string): Promise<IsbnBook | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isValidIsbn(isbn)) return null;

  const url = `${BOOKS_API_URL}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library ISBN lookup failed: ${response.status}`);
  }
  const json = (await response.json()) as Record<string, IsbnDataEntry>;
  return mapIsbnResponse(json, isbn);
}

// --- Rich work details (description, subjects, rating, year) -----------------
//
// The detail screen wants more than search/ISBN return. We pull it from the
// Works API (description + subjects) and the Ratings API (community rating).
// Each response→model step is a pure exported function, fixture-tested without
// network. Docs: https://openlibrary.org/dev/docs/api/books

export interface BookDetails {
  /** Plain-text synopsis, or null when Open Library has none. */
  description: string | null;
  /** Genre/topic tags, capped to a display-friendly count. */
  subjects: string[];
  firstPublishYear: number | null;
  /** Mean community rating (1–5), null when nobody has rated it. */
  ratingAverage: number | null;
  ratingCount: number;
}

/** Raw Works API shape (only the fields we read). */
interface WorkResponse {
  // Open Library returns description as either a plain string or {type, value}.
  description?: string | { value?: string };
  subjects?: string[];
  first_publish_date?: string;
}

/** Raw Ratings API shape. */
interface RatingsResponse {
  summary?: { average?: number | null; count?: number };
}

/** Raw Edition API shape — used only to resolve an edition key to its work. */
interface EditionResponse {
  works?: { key?: string }[];
}

const MAX_SUBJECTS = 12;

/** Parse a leading 4-digit year out of an Open Library date string. */
function parseYear(date: string | undefined): number | null {
  const match = date?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/** Map a Works response to the description/subjects/year slice. Pure — tested. */
export function mapWork(
  json: WorkResponse
): Pick<BookDetails, 'description' | 'subjects' | 'firstPublishYear'> {
  const raw = typeof json.description === 'string' ? json.description : json.description?.value;
  return {
    description: raw?.trim() || null,
    subjects: (json.subjects ?? []).slice(0, MAX_SUBJECTS),
    firstPublishYear: parseYear(json.first_publish_date),
  };
}

/** Map a Ratings response to the rating slice. Pure — tested. */
export function mapRatings(
  json: RatingsResponse
): Pick<BookDetails, 'ratingAverage' | 'ratingCount'> {
  const count = json.summary?.count ?? 0;
  const average = json.summary?.average ?? null;
  return {
    ratingAverage: count > 0 && average != null ? average : null,
    ratingCount: count,
  };
}

/**
 * Resolve any stored Open Library key to its canonical "/works/OL…W" key.
 * Search results already give a work key; ISBN scans give an edition
 * ("/books/OL…M") key that we follow once to find its work.
 */
async function resolveWorkKey(key: string): Promise<string | null> {
  if (key.startsWith('/works/')) return key;
  if (key.startsWith('/books/')) {
    const response = await fetch(`${OL_BASE}${key}.json`);
    if (!response.ok) return null;
    const json = (await response.json()) as EditionResponse;
    return json.works?.[0]?.key ?? null;
  }
  return null;
}

/**
 * Fetch rich metadata for a book by its stored Open Library key. Returns null
 * when the key can't be resolved to a work or the work fetch fails; a missing
 * ratings response just yields an unrated result rather than failing the whole
 * call. `firstPublishYear` is best-effort here — callers usually seed it from
 * the search result that already knew the year (see book-details-repo).
 */
export async function fetchWorkDetails(openLibraryKey: string): Promise<BookDetails | null> {
  const workKey = await resolveWorkKey(openLibraryKey);
  if (!workKey) return null;

  const [workRes, ratingsRes] = await Promise.all([
    fetch(`${OL_BASE}${workKey}.json`),
    fetch(`${OL_BASE}${workKey}/ratings.json`),
  ]);
  if (!workRes.ok) return null;

  const work = mapWork((await workRes.json()) as WorkResponse);
  const ratings = ratingsRes.ok
    ? mapRatings((await ratingsRes.json()) as RatingsResponse)
    : { ratingAverage: null, ratingCount: 0 };

  return { ...work, ...ratings };
}
