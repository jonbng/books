/**
 * Live elapsed-seconds counter for a running reading session.
 *
 * Deliberately kept *out* of AppDataProvider: a per-second setState there would
 * re-run computeStreak / computeStats / syncWidget and re-render every consumer
 * of useAppData. This hook ticks locally and is only mounted where the live time
 * is actually shown (the session screen and the Today resume strip).
 *
 * The elapsed value is *held in state* and recomputed from `startedAt` against
 * the wall clock inside the interval — never read from the clock during render.
 * Reading a mutable source (the clock) at render time is impure and, under React
 * 19 concurrent rendering, a pre-rendered-then-discarded pass can leave the
 * committed output stale, so the clock appears frozen. Recomputing in the
 * interval/foreground callbacks (and once immediately) keeps render pure: it just
 * returns the last committed value, which also self-corrects after the JS timer
 * is throttled in the background and is instantly correct when `startedAt`
 * changes (a session "survives" being backgrounded/killed).
 */

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { elapsedSeconds } from '@/lib/sessions';

export function useSessionTimer(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? elapsedSeconds(startedAt, new Date().toISOString()) : 0
  );

  useEffect(() => {
    const update = () =>
      setElapsed(startedAt ? elapsedSeconds(startedAt, new Date().toISOString()) : 0);
    update(); // correct immediately on mount, foreground, and `startedAt` changes
    if (!startedAt) return;
    const interval = setInterval(update, 1000);
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') update();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [startedAt]);

  return elapsed;
}
