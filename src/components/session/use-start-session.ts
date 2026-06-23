import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useToast } from '@/components/toast/toast-provider';
import { useAppData } from '@/hooks/use-app-data';
import { logError, toUserMessage } from '@/lib/errors';

/**
 * Shared "begin a reading session" entry logic so every surface (Today, the book
 * action sheet) behaves the same. A session is always tied to a book, so:
 *  - exactly one book on the Reading shelf → start it straight away (no picker),
 *  - zero or several → open {@link StartSessionSheet} to choose (or nudge to add).
 *
 * Returns the sheet's visibility props to spread onto <StartSessionSheet/>.
 */
export function useStartSession() {
  const data = useAppData();
  const { show: showToast } = useToast();
  const [sheetVisible, setSheetVisible] = useState(false);

  const begin = useCallback(async () => {
    const reading = data.booksByShelf.reading;
    if (reading.length === 1) {
      try {
        await data.startSession(reading[0].id);
        router.push('/session');
      } catch (err) {
        logError('useStartSession.begin', err);
        showToast(toUserMessage(err, 'Couldn’t start a session. Please try again.'));
      }
    } else {
      setSheetVisible(true); // 0 → nudge, 2+ → pick
    }
  }, [data, showToast]);

  return {
    begin,
    sheetVisible,
    closeSheet: useCallback(() => setSheetVisible(false), []),
  };
}
