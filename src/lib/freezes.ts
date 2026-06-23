/**
 * Freeze economy (DESIGN.md §4 "Freezes").
 *
 *  - You earn 1 freeze per 2-week streak.
 *  - Earning is **monotonic**: once credited for reaching a streak length, you
 *    keep the freeze even if the streak later breaks, and you don't re-earn it
 *    by regrowing back to the same length.
 *  - You can *hold* at most `maxFreezes` at a time (an open product question,
 *    default 3).
 *
 * Pure functions only — persistence lives in `db/freezes-repo.ts`.
 */

/** Weeks of streak required to earn one freeze. */
export const FREEZE_EARN_INTERVAL = 2;

/** Total freezes a streak of this length is worth (before monotonic crediting). */
export function freezesForStreak(weekStreak: number): number {
  return Math.floor(weekStreak / FREEZE_EARN_INTERVAL);
}

/** Persistent state behind monotonic earning. */
export interface FreezeCreditState {
  /** Lifetime freezes earned. */
  freezesEarned: number;
  /** Highest streak length already credited. */
  freezeCreditStreak: number;
}

/**
 * Given the current week streak and prior credit state, return the new credit
 * state. Only crossing a *new* (higher) even-week milestone earns more.
 */
export function reconcileFreezeCredit(
  current: FreezeCreditState,
  weekStreak: number
): FreezeCreditState {
  if (weekStreak <= current.freezeCreditStreak) return current;
  const newlyEarned =
    freezesForStreak(weekStreak) - freezesForStreak(current.freezeCreditStreak);
  return {
    freezesEarned: current.freezesEarned + newlyEarned,
    freezeCreditStreak: weekStreak,
  };
}

/** Freezes currently available to spend, capped at the hold limit. */
export function availableFreezes(params: {
  freezesEarned: number;
  used: number;
  maxFreezes: number;
}): number {
  const unspent = params.freezesEarned - params.used;
  return Math.max(0, Math.min(params.maxFreezes, unspent));
}

/** A week projected to just what auto-freeze selection needs. */
export interface AutoFreezeWeek {
  monday: string;
  /** 'complete' | 'frozen' | 'in-progress' | 'missed' */
  status: string;
}

/**
 * Freezes are spent **automatically** to protect the streak (DESIGN-UI.md): when
 * a past week's goal wasn't met, an available freeze covers it — no manual action.
 * The most recent missed (unfrozen) weeks are chosen first, up to the number
 * available. The current in-progress week is never frozen (it can still be hit).
 */
export function selectAutoFreezeWeeks(params: {
  weeks: AutoFreezeWeek[];
  frozenWeeks: string[];
  available: number;
  currentMonday: string;
}): string[] {
  if (params.available <= 0) return [];
  const frozen = new Set(params.frozenWeeks);
  return params.weeks
    .filter(
      (w) =>
        w.monday < params.currentMonday &&
        w.status === 'missed' &&
        !frozen.has(w.monday)
    )
    .map((w) => w.monday)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)) // most recent first
    .slice(0, params.available);
}
