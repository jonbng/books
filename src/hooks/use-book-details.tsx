/**
 * Lazy, stale-while-revalidate loader for a single book's rich Open Library
 * metadata. Kept deliberately off the global app-data `reload()` path: details
 * are per-screen and network-bound, so opening a book shouldn't reload the whole
 * library. Reads the cache first (instant), then refetches in the background
 * when the cache is missing or stale.
 */

import { useEffect, useState } from 'react';

import {
  cacheDetails,
  getBookDetails,
  seedDetailYear,
} from '@/db/book-details-repo';
import { fetchWorkDetails, type BookDetails } from '@/services/open-library';

export interface BookDetailsState {
  details: BookDetails | null;
  /** True only during the first fetch, when there's nothing cached to show. */
  loading: boolean;
}

export function useBookDetails(openLibraryKey: string | null): BookDetailsState {
  const [details, setDetails] = useState<BookDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!openLibraryKey) {
        if (!cancelled) {
          setDetails(null);
          setLoading(false);
        }
        return;
      }

      const cached = await getBookDetails(openLibraryKey);
      if (cancelled) return;
      if (cached) setDetails(cached.details);
      if (cached && !cached.stale) return;

      if (!cached) setLoading(true);
      try {
        const fresh = await fetchWorkDetails(openLibraryKey);
        if (cancelled || !fresh) return;
        await cacheDetails(openLibraryKey, fresh);
        // Re-read so a seeded year (which the fetch may not know) is folded in.
        const merged = await getBookDetails(openLibraryKey);
        if (!cancelled) setDetails(merged?.details ?? fresh);
      } catch {
        // Offline or a transient API error — keep whatever we had cached.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openLibraryKey]);

  return { details, loading };
}

/**
 * Fire-and-forget prefetch used when a book is added, so its detail screen is
 * already populated on first open. Seeds the year we know from search, then
 * caches a full fetch. Safe to call with a null/absent key (no-op).
 */
export async function prefetchBookDetails(
  openLibraryKey: string | null | undefined,
  firstPublishYear: number | null = null
): Promise<void> {
  if (!openLibraryKey) return;
  try {
    await seedDetailYear(openLibraryKey, firstPublishYear);
    const fresh = await fetchWorkDetails(openLibraryKey);
    if (fresh) await cacheDetails(openLibraryKey, fresh);
  } catch {
    // Best-effort warm-up; the lazy loader will retry on open.
  }
}
