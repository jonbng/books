/**
 * App data provider — the composition root that wires the SQLite repos, the pure
 * domain logic (streak, freezes, stats), and the notifications service into one
 * typed, reactive surface for the UI.
 *
 * Pattern: load all slices once, derive everything with `useMemo`, and after any
 * mutation write through a repo then `reload()`. Simple and predictable; if a
 * slice ever gets heavy we can split it without changing the consumer API.
 */

import React, { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { readCache, writeCache } from '@/db/api-cache-repo';
import {
  addBook as repoAddBook,
  deleteBook as repoDeleteBook,
  listBooks,
  markFinished as repoMarkFinished,
  moveToShelf as repoMoveToShelf,
  setCurrentPage as repoSetCurrentPage,
  setTotalPages as repoSetTotalPages,
  type Book,
  type NewBook,
} from '@/db/books-repo';
import {
  creditFreezesForStreak,
  freezeWeek as repoFreezeWeek,
  getFrozenWeeks,
  unfreezeWeek as repoUnfreezeWeek,
} from '@/db/freezes-repo';
import {
  loadReadingDays,
  markRead,
  seedDemoDataIfEmpty,
  setReadingDayDetail,
  unmarkRead,
  type ReadingDay,
} from '@/db/reading-repo';
import {
  cancelSession as repoCancelSession,
  finishSession as repoFinishSession,
  getActiveSession,
  listSessions,
  startSession as repoStartSession,
  type ReadingSession,
} from '@/db/sessions-repo';
import { resetAllData as repoResetAllData } from '@/db/database';
import { getSettings, updateSettings, type Settings } from '@/db/settings-repo';
import { availableFreezes, selectAutoFreezeWeeks } from '@/lib/freezes';
import { needsOnboarding } from '@/lib/onboarding';
import { mondayOf, todayISO } from '@/lib/dates';
import { type Shelf } from '@/lib/books';
import { aggregateSessions, type SessionAggregates } from '@/lib/sessions';
import { computeStats, type Stats } from '@/lib/stats';
import { type ColorSchemePreference } from '@/constants/theme';
import { computeStreak, type StreakResult } from '@/lib/streak';
import { logError } from '@/lib/errors';
import {
  cancelReminders,
  configureNotificationHandler,
  syncReminder,
} from '@/services/notifications';
import {
  fetchTrending as serviceFetchTrending,
  isbnToNewBook,
  lookupByIsbn,
  searchBooks as serviceSearchBooks,
  toNewBook,
  type BookSearchResult,
} from '@/services/open-library';
import { drainPendingMarks, syncWidget } from '@/services/widget';
import { prefetchBookDetails } from '@/hooks/use-book-details';

interface LoadedState {
  settings: Settings;
  readingDays: ReadingDay[];
  frozenWeeks: string[];
  books: Book[];
  activeSession: ReadingSession | null;
  sessions: ReadingSession[];
}

export interface AppData {
  ready: boolean;
  /** True when the initial load failed (e.g. the database couldn't open). */
  loadError: boolean;
  /** Retry the initial load after a {@link loadError}. */
  retryLoad: () => void;
  /** True once settings are loaded and first-run onboarding is still unfinished. */
  needsOnboarding: boolean;
  today: string;

  // Derived habit state
  streak: StreakResult | null;
  stats: Stats | null;
  settings: Settings | null;
  books: Book[];
  booksByShelf: Record<Shelf, Book[]>;
  /** Today's logged detail (pages read / attributed book), null until marked. */
  todayDetail: { pages: number | null; bookId: number | null } | null;

  // Reading sessions (timer)
  /** The session currently running, or null. Persists across app restarts. */
  activeSession: ReadingSession | null;
  /** Aggregated time/pages across finished sessions, for the Stats screen. */
  sessionStats: SessionAggregates | null;

  // Freezes
  availableFreezes: number;
  currentWeekFrozen: boolean;
  canFreezeCurrentWeek: boolean;

  // Core-loop actions
  toggleToday: (opts?: { pages?: number; bookId?: number }) => Promise<void>;
  /** Edit today's pages / attributed book without un-marking (Today inline editor). */
  setTodayDetail: (detail: { pages?: number | null; bookId?: number | null }) => Promise<void>;

  // Session actions
  /** Begin a timed session for a book. Rejects if one is already running. */
  startSession: (bookId: number) => Promise<void>;
  /** Finish the active session, recording pages read this session (>= 0). */
  finishSession: (pages: number) => Promise<void>;
  /** Discard the active session without recording anything. */
  cancelSession: () => Promise<void>;

  // Settings actions
  completeOnboarding: () => Promise<void>;
  setWeeklyTarget: (target: number) => Promise<void>;
  setMaxFreezes: (max: number) => Promise<void>;
  setYearlyGoal: (goal: number | null) => Promise<void>;
  setThemePreference: (preference: ColorSchemePreference) => Promise<void>;
  setReminder: (reminder: {
    enabled: boolean;
    hour: number;
    minute: number;
  }) => Promise<void>;
  /** A JSON snapshot of all on-device data, for the Settings export/backup action. */
  exportData: () => string | null;
  /** Erase reading data and reset goal/freeze settings to defaults. Irreversible. */
  resetAllData: () => Promise<void>;

  // Freeze actions
  freezeCurrentWeek: () => Promise<void>;
  unfreezeCurrentWeek: () => Promise<void>;

  // Book actions
  searchBooks: (query: string) => Promise<BookSearchResult[]>;
  /** Books currently trending on Open Library — shown before the user searches. */
  trendingBooks: () => Promise<BookSearchResult[]>;
  addBook: (book: NewBook) => Promise<Book>;
  addBookFromSearch: (result: BookSearchResult, shelf?: Shelf) => Promise<Book>;
  /** Look up an ISBN on Open Library and add it. Returns null if not found. */
  addBookByIsbn: (isbn: string, shelf?: Shelf) => Promise<Book | null>;
  setBookProgress: (id: number, currentPage: number) => Promise<void>;
  setBookTotalPages: (id: number, totalPages: number | null) => Promise<void>;
  moveBookToShelf: (id: number, shelf: Shelf) => Promise<void>;
  finishBook: (id: number) => Promise<void>;
  deleteBook: (id: number) => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

// Trending changes slowly (it's a weekly ranking), so cache it on-device and
// only refetch when the modal opens after the list has aged out.
const TRENDING_CACHE_KEY = 'trending:weekly';
const TRENDING_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const EMPTY_SHELVES: Record<Shelf, Book[]> = {
  reading: [],
  want_to_read: [],
  finished: [],
};

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadedState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const today = todayISO();

  const reload = useCallback(async () => {
    const [settings, readingDays, frozenWeeks, books, activeSession, sessions] =
      await Promise.all([
        getSettings(),
        loadReadingDays(),
        getFrozenWeeks(),
        listBooks(),
        getActiveSession(),
        listSessions(),
      ]);

    // Credit any freezes the current streak has newly earned (monotonic).
    const streak = computeStreak({
      readingDays: readingDays.map((d) => d.date),
      weeklyTarget: settings.weeklyTarget,
      frozenWeeks,
      today,
    });
    const credit = await creditFreezesForStreak(streak.weekStreak);

    // Freezes are automatic: spend whatever's banked to cover missed past weeks,
    // most recent first, so a bad week never silently breaks the streak. Newly
    // earned freezes from the now-longer streak are credited on the next reload
    // (monotonic — converges, no loop).
    const available = availableFreezes({
      freezesEarned: credit.freezesEarned,
      used: frozenWeeks.length,
      maxFreezes: settings.maxFreezes,
    });
    const toFreeze = selectAutoFreezeWeeks({
      weeks: streak.weeks,
      frozenWeeks,
      available,
      currentMonday: mondayOf(today),
    });
    for (const monday of toFreeze) {
      await repoFreezeWeek(monday);
    }
    const effectiveFrozen = toFreeze.length ? [...frozenWeeks, ...toFreeze] : frozenWeeks;

    setState({
      settings: { ...settings, ...credit },
      readingDays,
      frozenWeeks: effectiveFrozen,
      books,
      activeSession,
      sessions,
    });
  }, [today]);

  // Initial load (+ dev seed) and notification setup. Apply any reads tapped on
  // the home-screen widget before the first reload so they're already in the DB.
  // A failure here (a database that won't open/migrate) is fatal to the app, so
  // we flag it and let the UI offer a retry rather than hang on the splash.
  const bootstrap = useCallback(async () => {
    try {
      if (__DEV__) await seedDemoDataIfEmpty();
      await drainPendingMarks();
      await reload();
      // Clear any prior failure once we've recovered (e.g. a tapped retry). Set
      // after the awaits so we never call setState synchronously inside the effect.
      setLoadError(false);
    } catch (err) {
      logError('AppData.bootstrap', err);
      setLoadError(true);
    }
  }, [reload]);

  useEffect(() => {
    // bootstrap only ever setState()s after awaiting (drainPendingMarks/reload),
    // so it never renders synchronously — the rule can't see across the callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void bootstrap();
    void configureNotificationHandler();
  }, [bootstrap]);

  const streak = useMemo<StreakResult | null>(() => {
    if (!state) return null;
    return computeStreak({
      readingDays: state.readingDays.map((d) => d.date),
      weeklyTarget: state.settings.weeklyTarget,
      frozenWeeks: state.frozenWeeks,
      today,
    });
  }, [state, today]);

  // Re-lay the decaying reminder ladder from "now" using current settings +
  // engagement. No-ops in Expo Go/web. Reading "now" each time is the whole
  // point: opening the app resets the decay clock (see services/notifications).
  const syncReminders = useCallback(() => {
    if (!state?.settings.reminderEnabled || !streak) return;
    void syncReminder({
      reminderEnabled: state.settings.reminderEnabled,
      reminderHour: state.settings.reminderHour,
      reminderMinute: state.settings.reminderMinute,
      readToday: streak.readToday,
      hasActiveStreak: streak.weekStreak > 0,
    });
  }, [state, streak]);

  // Latest closure for the AppState handler, which mustn't re-subscribe on every
  // state change just to capture fresh settings/streak.
  const syncRemindersRef = useRef(syncReminders);

  // Reschedule after every reload (initial load, marking a read, settings change),
  // and keep the ref fresh for the foreground handler below.
  useEffect(() => {
    syncRemindersRef.current = syncReminders;
    syncReminders();
  }, [syncReminders]);

  // Reconcile widget taps AND reset the reminder decay when the app returns to
  // the foreground — opening the app counts as "still engaged".
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      void drainPendingMarks().then((changed) => {
        if (changed) void reload();
      });
      syncRemindersRef.current();
    });
    return () => sub.remove();
  }, [reload]);

  const stats = useMemo<Stats | null>(() => {
    if (!state) return null;
    return computeStats({
      readingDays: state.readingDays.map((d) => ({ date: d.date, pages: d.pages })),
      books: state.books.map((b) => ({ shelf: b.shelf, finishedAt: b.finishedAt })),
      today,
      yearlyGoal: state.settings.yearlyGoal,
    });
  }, [state, today]);

  const booksByShelf = useMemo<Record<Shelf, Book[]>>(() => {
    if (!state) return EMPTY_SHELVES;
    const grouped: Record<Shelf, Book[]> = { reading: [], want_to_read: [], finished: [] };
    for (const book of state.books) grouped[book.shelf].push(book);
    return grouped;
  }, [state]);

  const todayDetail = useMemo(() => {
    if (!state) return null;
    const row = state.readingDays.find((d) => d.date === today);
    return row ? { pages: row.pages, bookId: row.bookId } : null;
  }, [state, today]);

  const sessionStats = useMemo<SessionAggregates | null>(() => {
    if (!state) return null;
    return aggregateSessions(
      state.sessions.map((s) => ({
        sessionDate: s.sessionDate,
        durationSeconds: s.durationSeconds,
        pages: s.pages,
      })),
      today
    );
  }, [state, today]);

  const freezesAvailable = useMemo(() => {
    if (!state) return 0;
    return availableFreezes({
      freezesEarned: state.settings.freezesEarned,
      used: state.frozenWeeks.length,
      maxFreezes: state.settings.maxFreezes,
    });
  }, [state]);

  const currentMonday = mondayOf(today);
  const currentWeekFrozen = state?.frozenWeeks.includes(currentMonday) ?? false;

  // Keep the Android home-screen widget in sync with the same derived state the
  // Today screen shows. No-ops off Android. Runs after every reload via `state`.
  useEffect(() => {
    if (!state || !streak) return;
    void syncWidget({
      today,
      streak,
      settings: state.settings,
      availableFreezes: freezesAvailable,
      yearlyGoal: stats?.yearlyGoal ?? null,
      booksFinishedThisYear: stats?.booksFinishedThisYear ?? 0,
      currentBook: booksByShelf.reading[0] ?? null,
    });
  }, [state, streak, stats, booksByShelf, today, freezesAvailable]);

  // --- actions --------------------------------------------------------------

  // Apply a settings change to local state immediately so toggles/chips track
  // the tap, then persist + reload to reconcile. The reload lands on the same
  // value, so the control doesn't snap back and forth (the flicker).
  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev));
  }, []);

  const toggleToday = useCallback(
    async (opts?: { pages?: number; bookId?: number }) => {
      if (!streak) return;
      if (streak.readToday) {
        await unmarkRead(today);
      } else {
        await markRead(today, opts);
      }
      await reload();
    },
    [streak, today, reload]
  );

  const setTodayDetail = useCallback(
    async (detail: { pages?: number | null; bookId?: number | null }) => {
      await setReadingDayDetail(today, detail);
      await reload();
    },
    [today, reload]
  );

  const startSession = useCallback(
    async (bookId: number) => {
      await repoStartSession(bookId);
      await reload();
    },
    [reload]
  );

  const finishSession = useCallback(
    async (pages: number) => {
      await repoFinishSession({ pages });
      await reload();
    },
    [reload]
  );

  const cancelSession = useCallback(async () => {
    await repoCancelSession();
    await reload();
  }, [reload]);

  const completeOnboarding = useCallback(async () => {
    await updateSettings({ onboardingComplete: true });
    await reload();
  }, [reload]);

  const setWeeklyTarget = useCallback(
    async (target: number) => {
      patchSettings({ weeklyTarget: target });
      await updateSettings({ weeklyTarget: target });
      await reload();
    },
    [reload, patchSettings]
  );

  const setMaxFreezes = useCallback(
    async (max: number) => {
      patchSettings({ maxFreezes: max });
      await updateSettings({ maxFreezes: max });
      await reload();
    },
    [reload, patchSettings]
  );

  const setYearlyGoal = useCallback(
    async (goal: number | null) => {
      patchSettings({ yearlyGoal: goal });
      await updateSettings({ yearlyGoal: goal });
      await reload();
    },
    [reload, patchSettings]
  );

  const setThemePreference = useCallback(
    async (preference: ColorSchemePreference) => {
      patchSettings({ themePreference: preference });
      await updateSettings({ themePreference: preference });
      await reload();
    },
    [reload, patchSettings]
  );

  const setReminder = useCallback(
    async (reminder: { enabled: boolean; hour: number; minute: number }) => {
      patchSettings({
        reminderEnabled: reminder.enabled,
        reminderHour: reminder.hour,
        reminderMinute: reminder.minute,
      });
      await updateSettings({
        reminderEnabled: reminder.enabled,
        reminderHour: reminder.hour,
        reminderMinute: reminder.minute,
      });
      // Apply immediately so toggling on schedules (and off cancels) right away;
      // the reload-driven effect keeps it in sync thereafter. No-ops on web/Expo Go.
      await syncReminder({
        reminderEnabled: reminder.enabled,
        reminderHour: reminder.hour,
        reminderMinute: reminder.minute,
        readToday: streak?.readToday ?? false,
        hasActiveStreak: (streak?.weekStreak ?? 0) > 0,
      });
      await reload();
    },
    [reload, streak, patchSettings]
  );

  // A plain JSON snapshot of everything on this device — handed to the OS share
  // sheet as a portable backup. Reads the already-loaded state, so it's sync.
  const exportData = useCallback((): string | null => {
    if (!state) return null;
    return JSON.stringify(
      {
        format: 'books-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: state.settings,
        readingDays: state.readingDays,
        frozenWeeks: state.frozenWeeks,
        books: state.books,
        sessions: state.sessions,
      },
      null,
      2
    );
  }, [state]);

  const resetAllData = useCallback(async () => {
    await repoResetAllData();
    // Cancel any scheduled reminders so we don't keep nudging after a wipe; the
    // reset turned the reminder setting off, and reload reconciles the rest.
    await cancelReminders();
    await reload();
  }, [reload]);

  const freezeCurrentWeek = useCallback(async () => {
    await repoFreezeWeek(currentMonday);
    await reload();
  }, [currentMonday, reload]);

  const unfreezeCurrentWeek = useCallback(async () => {
    await repoUnfreezeWeek(currentMonday);
    await reload();
  }, [currentMonday, reload]);

  const searchBooks = useCallback((query: string) => serviceSearchBooks(query), []);

  const trendingBooks = useCallback(async () => {
    const cached = await readCache<BookSearchResult[]>(TRENDING_CACHE_KEY, TRENDING_TTL_MS);
    if (cached && !cached.stale) return cached.value;
    try {
      const fresh = await serviceFetchTrending('weekly');
      await writeCache(TRENDING_CACHE_KEY, fresh);
      return fresh;
    } catch (err) {
      // Offline or API hiccup — serve the stale list rather than nothing.
      if (cached) return cached.value;
      throw err;
    }
  }, []);

  const addBook = useCallback(
    async (book: NewBook) => {
      const created = await repoAddBook(book);
      await reload();
      return created;
    },
    [reload]
  );

  const addBookFromSearch = useCallback(
    async (result: BookSearchResult, shelf?: Shelf) => {
      const created = await repoAddBook(toNewBook(result, shelf));
      // Warm the detail cache so the book's page is populated on first open.
      void prefetchBookDetails(result.key, result.firstPublishYear);
      await reload();
      return created;
    },
    [reload]
  );

  const addBookByIsbn = useCallback(
    async (isbn: string, shelf?: Shelf) => {
      const found = await lookupByIsbn(isbn);
      if (!found) return null;
      const created = await repoAddBook(isbnToNewBook(found, shelf));
      void prefetchBookDetails(found.openLibraryKey);
      await reload();
      return created;
    },
    [reload]
  );

  const setBookProgress = useCallback(
    async (id: number, currentPage: number) => {
      await repoSetCurrentPage(id, currentPage);
      await reload();
    },
    [reload]
  );

  const setBookTotalPages = useCallback(
    async (id: number, totalPages: number | null) => {
      await repoSetTotalPages(id, totalPages);
      await reload();
    },
    [reload]
  );

  const moveBookToShelf = useCallback(
    async (id: number, shelf: Shelf) => {
      await repoMoveToShelf(id, shelf);
      await reload();
    },
    [reload]
  );

  const finishBook = useCallback(
    async (id: number) => {
      await repoMarkFinished(id);
      await reload();
    },
    [reload]
  );

  const deleteBook = useCallback(
    async (id: number) => {
      await repoDeleteBook(id);
      await reload();
    },
    [reload]
  );

  const value: AppData = {
    ready: state !== null,
    loadError,
    retryLoad: () => void bootstrap(),
    needsOnboarding: needsOnboarding(state?.settings ?? null),
    today,
    streak,
    stats,
    settings: state?.settings ?? null,
    books: state?.books ?? [],
    booksByShelf,
    todayDetail,
    activeSession: state?.activeSession ?? null,
    sessionStats,
    availableFreezes: freezesAvailable,
    currentWeekFrozen,
    canFreezeCurrentWeek: freezesAvailable > 0 && !currentWeekFrozen,
    toggleToday,
    setTodayDetail,
    startSession,
    finishSession,
    cancelSession,
    completeOnboarding,
    setWeeklyTarget,
    setMaxFreezes,
    setYearlyGoal,
    setThemePreference,
    setReminder,
    exportData,
    resetAllData,
    freezeCurrentWeek,
    unfreezeCurrentWeek,
    searchBooks,
    trendingBooks,
    addBook,
    addBookFromSearch,
    addBookByIsbn,
    setBookProgress,
    setBookTotalPages,
    moveBookToShelf,
    finishBook,
    deleteBook,
  };

  return <AppDataContext value={value}>{children}</AppDataContext>;
}

export function useAppData(): AppData {
  const data = use(AppDataContext);
  if (!data) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return data;
}
