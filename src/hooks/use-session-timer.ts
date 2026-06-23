/**
 * Live elapsed-seconds counter for a running reading session.
 *
 * Deliberately kept *out* of AppDataProvider: a per-second setState there would
 * re-run computeStreak / computeStats / syncWidget and re-render every consumer
 * of useAppData. This hook ticks locally and is only mounted where the live time
 * is actually shown (the session screen and the Today resume strip).
 *
 * Each tick recomputes elapsed from `startedAt` against the wall clock (never an
 * accumulator), so the value self-corrects after the JS timer is throttled or
 * paused in the background — and it re-syncs immediately when the app returns to
 * the foreground, which is how a session "survives" being backgrounded/killed.
 */

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { elapsedSeconds } from '@/lib/sessions';

export function useSessionTimer(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? elapsedSeconds(startedAt, new Date().toISOString()) : 0
  );

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const tick = () => setElapsed(elapsedSeconds(startedAt, new Date().toISOString()));
    tick(); // sync immediately on (re)start

    const interval = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') tick();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [startedAt]);

  return elapsed;
}
