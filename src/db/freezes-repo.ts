/**
 * Freeze persistence — the `week_freezes` table plus the monotonic credit state
 * stored on the settings row. Pure economy rules live in `lib/freezes.ts`.
 */

import {
  availableFreezes,
  reconcileFreezeCredit,
  type FreezeCreditState,
} from '@/lib/freezes';

import { getDb } from './database.ts';
import { getSettings, updateSettings } from './settings-repo.ts';

/** ISO Mondays of all frozen weeks. */
export async function getFrozenWeeks(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ week_start: string }>(
    'SELECT week_start FROM week_freezes ORDER BY week_start;'
  );
  return rows.map((r) => r.week_start);
}

/** How many freezes have been spent (one per frozen week). */
export async function countFreezesUsed(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM week_freezes;');
  return row?.c ?? 0;
}

/**
 * Credit any freezes newly earned by the given streak, persisting the monotonic
 * state. Returns the up-to-date credit state. Safe to call on every load.
 */
export async function creditFreezesForStreak(weekStreak: number): Promise<FreezeCreditState> {
  const settings = await getSettings();
  const current: FreezeCreditState = {
    freezesEarned: settings.freezesEarned,
    freezeCreditStreak: settings.freezeCreditStreak,
  };
  const next = reconcileFreezeCredit(current, weekStreak);
  if (next !== current) {
    await updateSettings({
      freezesEarned: next.freezesEarned,
      freezeCreditStreak: next.freezeCreditStreak,
    });
  }
  return next;
}

/** Freezes available to spend right now (earned − used, capped at maxFreezes). */
export async function getAvailableFreezes(): Promise<number> {
  const [settings, used] = await Promise.all([getSettings(), countFreezesUsed()]);
  return availableFreezes({
    freezesEarned: settings.freezesEarned,
    used,
    maxFreezes: settings.maxFreezes,
  });
}

/**
 * Freeze a week (by its Monday). Throws if no freeze is available. Idempotent:
 * re-freezing an already-frozen week is a no-op and consumes nothing.
 */
export async function freezeWeek(weekStart: string): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ week_start: string }>(
    'SELECT week_start FROM week_freezes WHERE week_start = ?;',
    [weekStart]
  );
  if (existing) return;

  const available = await getAvailableFreezes();
  if (available <= 0) {
    throw new Error('No freezes available to apply');
  }
  await db.runAsync('INSERT INTO week_freezes (week_start, applied_at) VALUES (?, ?);', [
    weekStart,
    new Date().toISOString(),
  ]);
}

/** Remove a freeze from a week, returning it to the balance. */
export async function unfreezeWeek(weekStart: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM week_freezes WHERE week_start = ?;', [weekStart]);
}
