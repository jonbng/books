/**
 * Streak milestones worth a celebration (DESIGN.md §8). Kept deliberately sparse
 * so the badge moment stays special and never nags — the first freeze-earning
 * mark, then a widening cadence.
 */
export const STREAK_MILESTONES = [2, 4, 8, 12, 16, 26, 52];

/**
 * The milestone just reached when the week-streak grows from `prev` to `next`,
 * or `null` if no milestone was crossed. Returns the highest milestone in the
 * half-open range `(prev, next]` so a jump can't skip a celebration.
 */
export function streakMilestoneReached(prev: number, next: number): number | null {
  if (next <= prev) return null;
  let hit: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (m > prev && m <= next) hit = m;
  }
  return hit;
}
