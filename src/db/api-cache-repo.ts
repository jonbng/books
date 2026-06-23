/**
 * Generic on-device cache for derived network responses keyed by a string
 * (e.g. `trending:weekly`). Stale-while-revalidate: a read returns whatever's
 * stored plus a `stale` flag the caller uses to decide whether to refetch.
 *
 * This is a network cache, not user-owned state — it's safe to drop and refetch
 * at any time. For per-book metadata use book-details-repo.ts instead.
 */

import { getDb } from './database.ts';

export interface Cached<T> {
  value: T;
  /** True once the entry has aged past the caller's TTL. */
  stale: boolean;
}

interface CacheRow {
  payload: string;
  fetched_at: string;
}

/**
 * Read a cached value, or null if nothing is stored (or the payload is corrupt).
 * `ttlMs` decides the `stale` flag without evicting — callers serve stale data
 * on a network failure and only replace it on a successful refetch.
 */
export async function readCache<T>(key: string, ttlMs: number): Promise<Cached<T> | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CacheRow>(
    `SELECT payload, fetched_at FROM api_cache WHERE key = ?;`,
    [key]
  );
  if (!row) return null;
  let value: T;
  try {
    value = JSON.parse(row.payload) as T;
  } catch {
    return null; // corrupt entry — treat as a miss
  }
  return { value, stale: Date.now() - new Date(row.fetched_at).getTime() > ttlMs };
}

/** Write (or replace) a cached value, stamping `fetched_at` to now. */
export async function writeCache<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO api_cache (key, payload, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         payload    = excluded.payload,
         fetched_at = excluded.fetched_at;`,
    [key, JSON.stringify(value), new Date().toISOString()]
  );
}
