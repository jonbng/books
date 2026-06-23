/**
 * Android home-screen widget bridge (DESIGN.md — the "did I read today?" surface
 * on the home screen). Projects the app's derived habit state into the snapshot
 * the Glance widget renders, and reconciles taps made on the widget back into the
 * database.
 *
 * Everything here no-ops off Android (the native module resolves to null), so the
 * iOS/web builds are untouched.
 */

import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

import type { Book } from '@/db/books-repo';
import { markRead } from '@/db/reading-repo';
import type { Settings } from '@/db/settings-repo';
import type { StreakResult } from '@/lib/streak';
import { buildWidgetSnapshot, widgetBookFrom, type WidgetBook } from '@/lib/widget-snapshot';

import BooksWidget from '../../modules/books-widget';

const isAndroid = Platform.OS === 'android';

export interface SyncWidgetInput {
  today: string;
  streak: StreakResult | null;
  settings: Settings | null;
  availableFreezes: number;
  yearlyGoal: number | null;
  booksFinishedThisYear: number;
  /** First book on the "reading" shelf, or null. */
  currentBook: Book | null;
}

/**
 * Ensure the current book's cover exists as a local file the widget can decode,
 * returning its absolute OS path. Covers are immutable per book id, so we only
 * download once and reuse the cached file on later syncs.
 */
async function ensureCover(book: Book | null): Promise<string | null> {
  if (!book?.coverUrl) return null;
  try {
    const dest = new File(Paths.document, `widget-cover-${book.id}.jpg`);
    if (dest.exists) return dest.uri.replace(/^file:\/\//, '');
    const out = await File.downloadFileAsync(book.coverUrl, dest);
    return out.uri.replace(/^file:\/\//, '');
  } catch {
    return null; // cover is optional — the widget falls back to a placeholder
  }
}

/** Write the latest snapshot and re-render the widget. Safe to call on every reload. */
export async function syncWidget(input: SyncWidgetInput): Promise<void> {
  if (!isAndroid || !BooksWidget || !input.streak) return;

  const coverPath = await ensureCover(input.currentBook);
  const book: WidgetBook | null = input.currentBook
    ? widgetBookFrom(input.currentBook, coverPath)
    : null;

  const snapshot = buildWidgetSnapshot({
    today: input.today,
    streak: input.streak,
    weeklyTarget: input.settings?.weeklyTarget ?? 5,
    availableFreezes: input.availableFreezes,
    yearlyGoal: input.yearlyGoal,
    booksFinishedThisYear: input.booksFinishedThisYear,
    book,
  });

  try {
    await BooksWidget.writeSnapshot(JSON.stringify(snapshot));
    await BooksWidget.refreshWidget();
  } catch {
    // Native failure / no widget added yet — non-fatal.
  }
}

/**
 * Drain the queue of dates the user marked read *from the widget* and write them
 * to the database. Returns true if anything was applied (so the caller can reload).
 */
export async function drainPendingMarks(): Promise<boolean> {
  if (!isAndroid || !BooksWidget) return false;

  let dates: unknown;
  try {
    dates = JSON.parse(await BooksWidget.getPendingMarks());
  } catch {
    return false;
  }
  if (!Array.isArray(dates)) return false;

  const unique = [...new Set(dates.filter((d): d is string => typeof d === 'string' && !!d))];
  if (unique.length === 0) return false;

  for (const date of unique) {
    await markRead(date);
  }
  return true;
}
