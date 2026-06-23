/**
 * Live elapsed-seconds counter for a running reading session.
 *
 * Deliberately kept *out* of AppDataProvider: a per-second setState there would
 * re-run computeStreak / computeStats / syncWidget and re-render every consumer
 * of useAppData. This hook ticks locally and is only mounted where the live time
 * is actually shown (the session screen and the Today resume strip).
 *
 * Elapsed is derived from `startedAt` against the wall clock on every render —
 * never accumulated — so it self-corrects after the JS timer is throttled in the
 * background and is instantly correct when `startedAt` changes. A 1s interval
 * (and an app-foreground event) just force a re-render; the setState lives only
 * in those callbacks, so a session "survives" being backgrounded/killed.
 */

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { elapsedSeconds } from '@/lib/sessions';

export function useSessionTimer(startedAt: string | null): number {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const bump = () => forceTick((t) => t + 1);
    const interval = setInterval(bump, 1000);
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') bump();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [startedAt]);

  return startedAt ? elapsedSeconds(startedAt, new Date().toISOString()) : 0;
}
