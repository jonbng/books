/**
 * On-device cache of rich Open Library metadata (description, subjects, rating,
 * year), keyed by `open_library_key`.
 *
 * Stale-while-revalidate: reads return whatever's cached plus a `stale` flag the
 * UI hook uses to decide whether to refetch (see hooks/use-book-details). Two
 * write paths merge into one row — `seedDetailYear` records the year we already
 * knew from a search result, and `cacheDetails` writes a full network fetch —
 * so the year survives even when a later fetch couldn't determine it.
 */

import type { BookDetails } from '@/services/open-library';

import { getDb } from './database.ts';

/** Cached details older than this (or never fetched) are considered stale. */
export const DETAILS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CachedDetails {
  details: BookDetails;
  /** True when there's no successful fetch yet or the cache has aged out. */
  stale: boolean;
}

interface DetailsRow {
  description: string | null;
  subjects: string | null;
  first_publish_year: number | null;
  rating_average: number | null;
  rating_count: number | null;
  fetched_at: string | null;
}

function parseSubjects(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isStale(fetchedAt: string | null, now: number): boolean {
  if (!fetchedAt) return true;
  return now - new Date(fetchedAt).getTime() > DETAILS_TTL_MS;
}

/** Read cached details for a key, or null if nothing has been stored yet. */
export async function getBookDetails(openLibraryKey: string): Promise<CachedDetails | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DetailsRow>(
    `SELECT description, subjects, first_publish_year, rating_average, rating_count, fetched_at
       FROM book_details WHERE open_library_key = ?;`,
    [openLibraryKey]
  );
  if (!row) return null;
  return {
    details: {
      description: row.description,
      subjects: parseSubjects(row.subjects),
      firstPublishYear: row.first_publish_year,
      ratingAverage: row.rating_average,
      ratingCount: row.rating_count ?? 0,
    },
    stale: isStale(row.fetched_at, Date.now()),
  };
}

/**
 * Record a year we already know (e.g. from a search result) without marking the
 * row fetched — so a full metadata fetch still runs. A later fetch that can't
 * determine the year keeps this one (COALESCE), but a fetch that does know wins.
 */
export async function seedDetailYear(
  openLibraryKey: string,
  firstPublishYear: number | null
): Promise<void> {
  if (firstPublishYear == null) return;
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO book_details (open_library_key, first_publish_year) VALUES (?, ?)
       ON CONFLICT(open_library_key) DO UPDATE SET
         first_publish_year = COALESCE(excluded.first_publish_year, book_details.first_publish_year);`,
    [openLibraryKey, firstPublishYear]
  );
}

/** Write a completed network fetch, stamping `fetched_at` to now. */
export async function cacheDetails(openLibraryKey: string, details: BookDetails): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO book_details
       (open_library_key, description, subjects, first_publish_year,
        rating_average, rating_count, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(open_library_key) DO UPDATE SET
       description        = excluded.description,
       subjects           = excluded.subjects,
       first_publish_year = COALESCE(excluded.first_publish_year, book_details.first_publish_year),
       rating_average     = excluded.rating_average,
       rating_count       = excluded.rating_count,
       fetched_at         = excluded.fetched_at;`,
    [
      openLibraryKey,
      details.description,
      JSON.stringify(details.subjects),
      details.firstPublishYear,
      details.ratingAverage,
      details.ratingCount,
      new Date().toISOString(),
    ]
  );
}
