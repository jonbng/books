import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { useConfirm } from '@/components/confirm/confirm-provider';
import { PaperBackground } from '@/components/paper';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast/toast-provider';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useSessionTimer } from '@/hooks/use-session-timer';
import { useTheme } from '@/hooks/use-theme';
import { logError, toUserMessage } from '@/lib/errors';
import { formatDuration } from '@/lib/sessions';

type Phase = 'running' | 'finishing';

/**
 * The live reading-session screen — a focused, dismissible modal (not a stack
 * destination). While `running` it shows a calm clock (ticking seconds) for the
 * active book; `finishing` asks which page you ended on via a horizontal
 * scrubber, which is easier to recall than counting pages. Saving folds the
 * session into the book's progress and today's reading (see
 * sessions-repo.finishSession): the pages read = end page − start page.
 *
 * A book with no known page count can't be scrubbed, so `finishing` first asks
 * for the total once, then reveals the scrubber.
 *
 * No per-second animation or haptics on the clock: a haptic that fires every
 * second would blow the app's three-moments ration (DESIGN-UI §5). Haptics here
 * are the scrubber's per-page ticks and the Success on save.
 */
export default function SessionScreen() {
  const data = useAppData();
  const theme = useTheme();
  const confirm = useConfirm();
  const { show: showToast } = useToast();
  const { activeSession } = data;
  const elapsed = useSessionTimer(activeSession?.startedAt ?? null);

  const [phase, setPhase] = useState<Phase>('running');
  // The page the user landed on. Null until they move the scrubber; until then
  // it sits at the start page (a zero-page session — still records the time).
  const [endPage, setEndPage] = useState<number | null>(null);
  // Set before we finish/cancel so the activeSession→null reload doesn't trip the
  // auto-dismiss below (we navigate ourselves). Also covers the book being deleted
  // mid-session: that nulls activeSession without `acting`, so we fall back to Today.
  const acting = useRef(false);

  useEffect(() => {
    if (!activeSession && !acting.current) router.back();
  }, [activeSession]);

  const book = activeSession
    ? data.books.find((b) => b.id === activeSession.bookId) ?? null
    : null;

  // Where the session began. The book only advances via sessions / manual edits,
  // so its current page at finish time is the session's start page.
  const startPage = book?.currentPage ?? 0;
  const total = book?.totalPages ?? null;
  const landedOn = endPage ?? startPage;
  const pagesRead = Math.max(0, landedOn - startPage);

  const save = async () => {
    acting.current = true;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await data.finishSession(pagesRead);
      router.back();
    } catch (err) {
      // Keep the user on the timer with their session intact so they can retry.
      acting.current = false;
      logError('session.save', err);
      showToast(toUserMessage(err, 'Couldn’t save this session. Please try again.'));
    }
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Discard this session?',
      message: 'The time and pages for this session won’t be saved.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep going',
      destructive: true,
    });
    if (!ok) return;
    acting.current = true;
    try {
      await data.cancelSession();
      router.back();
    } catch (err) {
      acting.current = false;
      logError('session.cancel', err);
      showToast(toUserMessage(err, 'Couldn’t discard this session. Please try again.'));
    }
  };

  return (
    <PaperBackground>
      <ScreenHeader title="" onBack={() => router.back()} />
      <View style={styles.content}>
        {book ? (
          <View style={styles.bookRow}>
            <BookCover
              coverUrl={book.coverUrl}
              coverWidth={book.coverWidth}
              coverHeight={book.coverHeight}
              height={120}
              elevation="hero"
            />
            <Text style={[styles.bookTitle, { color: theme.text }]} numberOfLines={2}>
              {book.title}
            </Text>
            {book.author ? (
              <Text style={[styles.bookAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                {book.author}
              </Text>
            ) : null}
          </View>
        ) : null}

        {phase === 'running' ? (
          <>
            <View style={styles.clockBlock}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>READING</Text>
              <Text style={[styles.clock, { color: theme.text }]}>{formatDuration(elapsed)}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => setPhase('finishing')}
                accessibilityRole="button"
                accessibilityLabel="Finish session"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.primaryText}>Finish session</Text>
              </Pressable>
              <Pressable
                onPress={cancel}
                accessibilityRole="button"
                accessibilityLabel="Discard session"
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Discard</Text>
              </Pressable>
            </View>
          </>
        ) : total == null ? (
          // No page count yet — ask once, then the scrubber can appear.
          <TotalPagesPrompt
            elapsed={elapsed}
            onSet={(n) => {
              if (!book) return;
              data.setBookTotalPages(book.id, n).catch((err) => {
                logError('session.setTotalPages', err);
                showToast(toUserMessage(err, 'Couldn’t save the page count. Please try again.'));
              });
            }}
            onBack={() => setPhase('running')}
          />
        ) : (
          <>
            <View style={styles.finishBlock}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {formatDuration(elapsed)} · WHERE DID YOU END?
              </Text>

              <View style={styles.readout}>
                <Text style={[styles.pageWord, { color: theme.textSecondary }]}>page</Text>
                <Text style={[styles.pageNumber, { color: theme.text }]}>{landedOn}</Text>
                <Text style={[styles.pageTotal, { color: theme.textSecondary }]}>/ {total}</Text>
              </View>
              <Text style={[styles.pagesRead, { color: theme.accent }]}>
                {pagesRead === 1 ? '1 page' : `${pagesRead} pages`} this session
              </Text>

              <PageScrubber
                startPage={startPage}
                total={total}
                value={landedOn}
                onChange={setEndPage}
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={save}
                accessibilityRole="button"
                accessibilityLabel="Save session"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.primaryText}>Save session</Text>
              </Pressable>
              <Pressable
                onPress={() => setPhase('running')}
                accessibilityRole="button"
                accessibilityLabel="Back to timer"
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Back to timer</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </PaperBackground>
  );
}

/**
 * Horizontal page scrubber: drag (or tap) the track to pick the page you ended
 * on, between `startPage` and `total`. A selection haptic fires on each page the
 * thumb crosses. Built on PanResponder (no GestureHandlerRootView at the app
 * root) — `dx` is added to the grant position so tracking is robust regardless
 * of where the finger wanders off the track.
 */
function PageScrubber({
  startPage,
  total,
  value,
  onChange,
}: {
  startPage: number;
  total: number;
  value: number;
  onChange: (page: number) => void;
}) {
  const theme = useTheme();
  const range = Math.max(1, total - startPage);
  const fraction = Math.min(1, Math.max(0, (value - startPage) / range));

  // The responder is created once, so keep the live geometry/handlers in refs it
  // can read at gesture time. They're synced after each commit (never written
  // during render) so concurrent rendering can't observe a torn value.
  const widthRef = useRef(0);
  const grantXRef = useRef(0);
  const lastPageRef = useRef(value);
  const latest = useRef({ startPage, total, onChange });
  useEffect(() => {
    latest.current = { startPage, total, onChange };
    // Follow external value changes so we don't re-emit a haptic for a page the
    // parent already set.
    lastPageRef.current = value;
  });

  const handleX = useCallback((x: number) => {
    const { startPage, total, onChange } = latest.current;
    const w = widthRef.current || 1;
    const f = Math.min(1, Math.max(0, x / w));
    const r = Math.max(1, total - startPage);
    const page = startPage + Math.round(f * r);
    const clamped = Math.min(total, Math.max(startPage, page));
    if (clamped !== lastPageRef.current) {
      lastPageRef.current = clamped;
      Haptics.selectionAsync().catch(() => {});
      onChange(clamped);
    }
  }, []);

  // Created once (lazy state init) and only ever invoked by native touch events —
  // never during render — so reading the geometry refs inside the handlers is
  // safe. The compiler can't prove that statically (it conservatively flags any
  // ref read reachable from a value created in render), so scope the rule off.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        grantXRef.current = e.nativeEvent.locationX;
        handleX(grantXRef.current);
      },
      onPanResponderMove: (_e, g) => handleX(grantXRef.current + g.dx),
    })
  );

  const step = (delta: number) => {
    const next = Math.min(total, Math.max(startPage, value + delta));
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };

  return (
    <View style={styles.scrubber}>
      <View
        {...responder.panHandlers}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
        }}
        hitSlop={{ top: 16, bottom: 16 }}
        accessibilityRole="adjustable"
        accessibilityLabel="Page you ended on"
        accessibilityValue={{ min: startPage, max: total, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          step(e.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
        style={styles.trackHit}>
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[styles.trackFill, { width: `${fraction * 100}%`, backgroundColor: theme.accent }]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            {
              left: `${fraction * 100}%`,
              backgroundColor: theme.accent,
              borderColor: theme.background,
            },
          ]}
        />
      </View>
      <View style={styles.scrubberEnds}>
        <Text style={[styles.endLabel, { color: theme.textSecondary }]}>{startPage}</Text>
        <Text style={[styles.endLabel, { color: theme.textSecondary }]}>{total}</Text>
      </View>
    </View>
  );
}

/** Asks for the book's total page count once, so the scrubber has a range. */
function TotalPagesPrompt({
  elapsed,
  onSet,
  onBack,
}: {
  elapsed: number;
  onSet: (n: number) => void | Promise<void>;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const parsed = parseInt(value, 10);
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <>
      <View style={styles.finishBlock}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {formatDuration(elapsed)} · HOW MANY PAGES IS THIS BOOK?
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          returnKeyType="done"
          autoFocus
          placeholder="—"
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.accent}
          cursorColor={theme.accent}
          onSubmitEditing={() => valid && onSet(parsed)}
          style={[styles.totalInput, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
        />
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          We’ll use this to track where you finish.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => valid && onSet(parsed)}
          disabled={!valid}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
            !valid && styles.disabled,
          ]}>
          <Text style={styles.primaryText}>Continue</Text>
        </Pressable>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to timer"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Back to timer</Text>
        </Pressable>
      </View>
    </>
  );
}

const THUMB_SIZE = 28;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.six,
  },
  bookRow: { alignItems: 'center', gap: Spacing.two },
  bookTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  bookAuthor: { fontSize: 15, fontWeight: '500' },
  clockBlock: { alignItems: 'center', gap: Spacing.three },
  label: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
    textAlign: 'center',
  },
  clock: {
    fontFamily: FontFamily.semibold,
    fontSize: 72,
    lineHeight: 80,
    fontVariant: ['tabular-nums'],
  },
  finishBlock: { alignSelf: 'stretch', alignItems: 'center', gap: Spacing.three },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  pageWord: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pageNumber: {
    fontFamily: FontFamily.semibold,
    fontSize: 56,
    lineHeight: 62,
    fontVariant: ['tabular-nums'],
  },
  pageTotal: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  pagesRead: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scrubber: { alignSelf: 'stretch', marginTop: Spacing.two },
  trackHit: { justifyContent: 'center', paddingVertical: Spacing.three },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4 },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    marginLeft: -THUMB_SIZE / 2,
    boxShadow: '0px 2px 6px rgba(60, 40, 25, 0.25)',
  },
  scrubberEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  endLabel: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  totalInput: {
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    fontFamily: FontFamily.semibold,
    fontVariant: ['tabular-nums'],
    fontSize: 28,
  },
  hint: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: Spacing.two },
  primary: {
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
    borderCurve: 'continuous',
    alignItems: 'center',
    boxShadow: '0px 6px 16px rgba(60, 40, 25, 0.18)',
  },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
