import React, { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';

import type { Book } from '@/db/books-repo';
import { useAppData } from '@/hooks/use-app-data';
import { streakMilestoneReached } from '@/lib/milestones';
import { BookFinishedCelebration } from './book-finished-celebration';
import { StreakMilestoneCelebration } from './streak-milestone-celebration';

export type CelebrationEvent =
  | { kind: 'book-finished'; book: Book }
  | { kind: 'streak-milestone'; weeks: number };

type QueuedEvent = CelebrationEvent & { id: number };

type CelebrationApi = { celebrate: (event: CelebrationEvent) => void };

const CelebrationContext = createContext<CelebrationApi | null>(null);

/**
 * Hosts the app's "cozy payoff moments" (DESIGN.md §8) above the navigator. Lives
 * inside `AppDataProvider` so it can read habit state. Two kinds of events:
 *  - `book-finished` — fired explicitly from the finish call sites.
 *  - `streak-milestone` — detected here by diffing `weekStreak` across reloads.
 * Events queue so two payoffs (e.g. finishing a book that also completes a
 * milestone week) play one after the other rather than clobbering.
 */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const { streak, ready } = useAppData();
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const idRef = useRef(0);

  const celebrate = useCallback((event: CelebrationEvent) => {
    idRef.current += 1;
    const id = idRef.current;
    setQueue((q) => [...q, { ...event, id }]);
  }, []);
  // Dismiss by id so a stray double-call (auto-dismiss timeout + a tap) can't
  // advance the queue twice and silently drop the next celebration.
  const dismiss = useCallback((id: number) => {
    setQueue((q) => (q[0]?.id === id ? q.slice(1) : q));
  }, []);
  const current = queue[0] ?? null;

  // Milestone detection. Seed the ref from the *loaded* streak (gated on `ready`)
  // so a returning user's existing streak is never mistaken for a fresh crossing
  // — before load, `streak` is null and weekStreak falls back to 0, which would
  // otherwise fire a bogus milestone the moment real data arrives.
  const prevStreak = useRef<number | null>(null);
  const weekStreak = streak?.weekStreak ?? 0;
  useEffect(() => {
    if (!ready) return;
    if (prevStreak.current === null) {
      prevStreak.current = weekStreak;
      return;
    }
    const hit = streakMilestoneReached(prevStreak.current, weekStreak);
    prevStreak.current = weekStreak;
    if (hit) celebrate({ kind: 'streak-milestone', weeks: hit });
  }, [ready, weekStreak, celebrate]);

  return (
    <CelebrationContext value={{ celebrate }}>
      {children}
      <Modal
        visible={!!current}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => current && dismiss(current.id)}>
        {current?.kind === 'book-finished' ? (
          <BookFinishedCelebration book={current.book} onDismiss={() => dismiss(current.id)} />
        ) : null}
        {current?.kind === 'streak-milestone' ? (
          <StreakMilestoneCelebration weeks={current.weeks} onDismiss={() => dismiss(current.id)} />
        ) : null}
      </Modal>
    </CelebrationContext>
  );
}

export function useCelebration(): CelebrationApi {
  const api = use(CelebrationContext);
  if (!api) throw new Error('useCelebration must be used within a CelebrationProvider');
  return api;
}
