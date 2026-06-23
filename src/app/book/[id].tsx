import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BookCover } from '@/components/book-cover';
import { useCelebration } from '@/components/celebration/celebration-provider';
import { useConfirm } from '@/components/confirm/confirm-provider';
import { Paper } from '@/components/paper';
import { PressableScale } from '@/components/pressable-scale';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast/toast-provider';
import { FontFamily, Motion, Spacing, Type } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useBookDetails } from '@/hooks/use-book-details';
import { useTheme } from '@/hooks/use-theme';
import { daysToFinish, readingPercent, SHELF_LABELS, type Shelf } from '@/lib/books';
import { formatLongDate } from '@/lib/dates';
import { logError, toUserMessage } from '@/lib/errors';

const SHELF_ORDER: Shelf[] = ['want_to_read', 'reading', 'finished'];

// House easing as a worklet-safe timing config.
const HERO_IN = {
  duration: 440,
  easing: Easing.bezier(...Motion.easingBezier),
} as const;
const HERO_OUT = {
  duration: 300,
  easing: Easing.bezier(...Motion.easingBezier),
} as const;

export default function BookScreen() {
  const params = useLocalSearchParams<{
    id: string;
    ox?: string;
    oy?: string;
    ow?: string;
    oh?: string;
  }>();
  const { id } = params;
  const data = useAppData();
  const theme = useTheme();
  const { celebrate } = useCelebration();
  const confirm = useConfirm();
  const { show: showToast } = useToast();
  const book = data.books.find((b) => b.id === Number(id));
  const { details, loading: detailsLoading } = useBookDetails(book?.openLibraryKey ?? null);

  const { height: screenH } = useWindowDimensions();
  const reduced = useReducedMotion();

  // The shelf cover's on-screen rect (window coords) passed from the tap, if we
  // arrived from a cover. Drives the shared-element fly between shelf and page.
  const origin = useMemo(() => {
    const ox = Number(params.ox);
    const oy = Number(params.oy);
    const ow = Number(params.ow);
    const oh = Number(params.oh);
    if ([ox, oy, ow, oh].every(Number.isFinite) && ow > 0 && oh > 0) {
      return { x: ox, y: oy, w: ow, h: oh };
    }
    return null;
  }, [params.ox, params.oy, params.ow, params.oh]);

  // enter: 0 = page gone / cover sitting on the shelf, 1 = fully open on the page.
  // dragY: live downward drag of the page (finger-attached dismiss).
  const enter = useSharedValue(reduced ? 1 : 0);
  const dragY = useSharedValue(0);
  // The detail cover's natural (final) rect, measured on mount; the cover flies
  // between this and `origin` (FLIP). measured gates visibility to avoid a flash.
  const naturalRect = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });
  // Hold the cover hidden only while we await its measurement for the fly — but
  // with no origin (or reduced motion) there's nothing to wait for.
  const measured = useSharedValue(origin && !reduced ? 0 : 1);

  const coverWrapRef = useRef<View>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const atTop = useSharedValue(false);
  const started = useRef(false);

  const startEnter = useCallback(() => {
    if (started.current || reduced) return;
    started.current = true;
    enter.set(withTiming(1, HERO_IN));
  }, [enter, reduced]);

  // No cover origin → nothing to measure; play a centered fade/scale-in on mount.
  useEffect(() => {
    if (!origin) startEnter();
  }, [origin, startEnter]);

  const onCoverLayout = useCallback(() => {
    if (!origin) return;
    coverWrapRef.current?.measureInWindow((x, y, w, h) => {
      if (!w || !h) return;
      naturalRect.set({ x, y, w, h });
      measured.set(1);
      startEnter();
    });
  }, [origin, naturalRect, measured, startEnter]);

  const popBack = useCallback(() => router.back(), []);

  // Reverse the hero, then pop. The back button and a committed drag both use this.
  const close = useCallback(() => {
    if (reduced) {
      router.back();
      return;
    }
    dragY.set(withTiming(0, { duration: Motion.durations.base }));
    enter.set(
      withTiming(0, HERO_OUT, (finished) => {
        if (finished) runOnJS(popBack)();
      }),
    );
  }, [reduced, dragY, enter, popBack]);

  const DISMISS = screenH * 0.28;

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  // Drag the page down to dismiss — but only when the scroll view starts at the
  // top, so it never fights an upward scroll. All on the UI thread → Android too.
  const pan = Gesture.Pan()
    .activeOffsetY(14)
    // Runtime-valid; the animated ref's type is narrower than the API's.
    // eslint-disable-next-line react-hooks/refs
    .simultaneousWithExternalGesture(scrollRef as never)
    .onBegin(() => {
      atTop.set(scrollY.get() <= 0);
    })
    .onUpdate((e) => {
      if (atTop.get() && e.translationY > 0) dragY.set(e.translationY);
    })
    .onEnd((e) => {
      if (!atTop.get()) return;
      if (dragY.get() > DISMISS || e.velocityY > 1100) {
        dragY.set(withTiming(0, { duration: Motion.durations.base }));
        enter.set(
          withTiming(0, HERO_OUT, (finished) => {
            if (finished) runOnJS(popBack)();
          }),
        );
      } else {
        dragY.set(withSpring(0, Motion.successSpring));
      }
    });

  // The cover's FLIP transform: at enter=0 it sits exactly over `origin` (its
  // spot on the shelf), at enter=1 it rests in its natural place on the page.
  const coverStyle = useAnimatedStyle(() => {
    const n = naturalRect.get();
    if (!origin || n.w === 0) {
      // Fallback (no origin) or not yet measured: a quiet scale-in / hold hidden.
      return {
        opacity: origin ? measured.get() : 1,
        transform: [
          {
            scale: interpolate(enter.get(), [0, 1], [origin ? 1 : 0.92, 1], Extrapolation.CLAMP),
          },
        ],
      };
    }
    const e = enter.get();
    const scale = interpolate(e, [0, 1], [origin.w / n.w, 1], Extrapolation.CLAMP);
    const tx = interpolate(
      e,
      [0, 1],
      [origin.x + origin.w / 2 - (n.x + n.w / 2), 0],
      Extrapolation.CLAMP,
    );
    const ty = interpolate(
      e,
      [0, 1],
      [origin.y + origin.h / 2 - (n.y + n.h / 2), 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  // The page itself: follows the finger down, shrinks and rounds its corners so
  // it reads as a card peeling away to reveal the shelf behind (transparent modal).
  const pageStyle = useAnimatedStyle(() => {
    const dy = dragY.get();
    return {
      borderRadius: interpolate(dy, [0, 60], [0, 30], Extrapolation.CLAMP),
      transform: [
        { translateY: dy },
        { scale: interpolate(dy, [0, screenH], [1, 0.9], Extrapolation.CLAMP) },
      ],
    };
  });
  // The paper plane fades in with the hero (and out on close), so for the first
  // instant the shelf still shows behind the flying cover.
  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.get(), [0, 0.5], [0, 1], Extrapolation.CLAMP),
  }));
  // Everything that isn't the cover rises and fades in just behind it.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(enter.get(), [0.25, 1], [10, 0], Extrapolation.CLAMP),
      },
    ],
  }));
  // A dim scrim over the shelf behind — strongest when open, clearing as you drag.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(enter.get(), [0, 1], [0, 0.32], Extrapolation.CLAMP) *
      interpolate(dragY.get(), [0, DISMISS], [1, 0], Extrapolation.CLAMP),
  }));

  if (!book) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ScreenHeader title="" />
        <View style={styles.missing}>
          <Text style={{ color: theme.textSecondary }}>This book is no longer on your shelf.</Text>
        </View>
      </View>
    );
  }

  const percent = readingPercent(book.currentPage, book.totalPages);

  async function onMove(shelf: Shelf) {
    if (!book || shelf === book.shelf) return;
    await Haptics.selectionAsync();
    try {
      await data.moveBookToShelf(book.id, shelf);
    } catch (err) {
      logError('book.onMove', err);
      showToast(toUserMessage(err, 'Couldn’t move that book. Please try again.'));
    }
  }

  async function onFinish() {
    if (!book) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await data.finishBook(book.id);
      celebrate({ kind: 'book-finished', book });
    } catch (err) {
      logError('book.onFinish', err);
      showToast(toUserMessage(err, 'Couldn’t mark that finished. Please try again.'));
    }
  }

  async function onStartSession() {
    if (!book) return;
    // If a session is already running, this button reads "Resume" and just
    // returns to it (starting a second would violate the one-active invariant).
    try {
      if (!data.activeSession) await data.startSession(book.id);
      router.push('/session');
    } catch (err) {
      logError('book.onStartSession', err);
      showToast(toUserMessage(err, 'Couldn’t start a session. Please try again.'));
    }
  }

  async function changePage(delta: number) {
    if (!book) return;
    const max = book.totalPages ?? Number.MAX_SAFE_INTEGER;
    const next = Math.max(0, Math.min(max, book.currentPage + delta));
    try {
      await data.setBookProgress(book.id, next);
    } catch (err) {
      logError('book.changePage', err);
      showToast(toUserMessage(err, 'Couldn’t update your progress. Please try again.'));
    }
  }

  async function onDelete() {
    if (!book) return;
    const ok = await confirm({
      title: 'Remove from library',
      message: `Remove "${book.title}" from your library? This can't be undone.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    try {
      await data.deleteBook(book.id);
      router.back();
    } catch (err) {
      logError('book.onDelete', err);
      showToast(toUserMessage(err, 'Couldn’t remove that book. Please try again.'));
    }
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Dim the live shelf showing through the transparent modal, clearing as
          the page is dragged away. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
      />
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.page, pageStyle]}>
          {/* Paper plane — fades in/out so the flying cover crosses over the shelf. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }, bgStyle]}
          />
          <Animated.View style={contentStyle}>
            <ScreenHeader title="" onBack={close} />
          </Animated.View>
          <Animated.ScrollView
            ref={scrollRef}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={styles.content}
          >
            <View style={styles.hero}>
              {/* Untransformed wrapper measured for the FLIP; the inner view flies. */}
              <View ref={coverWrapRef} onLayout={onCoverLayout} collapsable={false}>
                <Animated.View style={coverStyle}>
                  <BookCover
                    coverUrl={book.coverUrl}
                    coverWidth={book.coverWidth}
                    coverHeight={book.coverHeight}
                    height={248}
                    elevation="hero"
                  />
                </Animated.View>
              </View>
              <Animated.View style={[styles.heroMeta, contentStyle]}>
                <Text style={[styles.title, { color: theme.text }]}>{book.title}</Text>
                {book.author ? (
                  <Text style={[styles.author, { color: theme.textSecondary }]}>{book.author}</Text>
                ) : null}
              </Animated.View>
              <BookFacts
                year={details?.firstPublishYear ?? null}
                pages={book.totalPages}
                ratingAverage={details?.ratingAverage ?? null}
                ratingCount={details?.ratingCount ?? 0}
              />
            </View>

            <Animated.View style={[styles.afterHero, contentStyle]}>
              {/* Shelf status */}
              <View style={styles.segment}>
                {SHELF_ORDER.map((shelf) => {
                  const active = shelf === book.shelf;
                  return (
                    <PressableScale
                      key={shelf}
                      onPress={() => onMove(shelf)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={SHELF_LABELS[shelf]}
                      style={[
                        styles.segItem,
                        {
                          backgroundColor: active ? theme.accent : theme.backgroundElement,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segText,
                          { color: active ? '#FFFFFF' : theme.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {SHELF_LABELS[shelf]}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              {/* Finished — a small "you read this" summary in place of the steppers */}
              {book.shelf === 'finished' ? (
                <FinishedSummary
                  finishedAt={book.finishedAt}
                  startedAt={book.startedAt}
                  totalPages={book.totalPages}
                />
              ) : null}

              {/* Progress */}
              {book.shelf === 'reading' ? (
                <Paper style={styles.progressCard}>
                  <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>PROGRESS</Text>
                  <View style={styles.progressRow}>
                    <Stepper label="−10" onPress={() => changePage(-10)} />
                    <Stepper label="−1" onPress={() => changePage(-1)} />
                    <View style={styles.pageReadout}>
                      <Text style={[styles.pageNum, { color: theme.text }]}>
                        {book.currentPage}
                        {book.totalPages ? (
                          <Text style={{ color: theme.textSecondary }}> / {book.totalPages}</Text>
                        ) : null}
                      </Text>
                      {book.totalPages ? (
                        <Text style={[styles.pagePct, { color: theme.accent }]}>{percent}%</Text>
                      ) : null}
                    </View>
                    <Stepper label="+1" onPress={() => changePage(1)} />
                    <Stepper label="+10" onPress={() => changePage(10)} />
                  </View>
                  <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                    <View
                      style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.accent }]}
                    />
                  </View>
                  <TotalPagesEditor
                    total={book.totalPages}
                    onSet={(n) =>
                      data.setBookTotalPages(book.id, n).catch((err) => {
                        logError('book.setTotalPages', err);
                        showToast(toUserMessage(err, 'Couldn’t update the page count.'));
                      })
                    }
                  />
                </Paper>
              ) : null}

              {/* Start / resume a timed session — hidden if a session for another book
            is running, since only one can be active at a time. */}
              {book.shelf === 'reading' &&
              (!data.activeSession || data.activeSession.bookId === book.id) ? (
                <PressableScale
                  onPress={onStartSession}
                  accessibilityRole="button"
                  accessibilityLabel={
                    data.activeSession?.bookId === book.id
                      ? 'Resume reading session'
                      : 'Start reading session'
                  }
                  style={[styles.sessionButton, { borderColor: theme.accent }]}
                >
                  <Text style={[styles.sessionText, { color: theme.accent }]}>
                    {data.activeSession?.bookId === book.id
                      ? 'Resume reading session'
                      : 'Start reading session'}
                  </Text>
                </PressableScale>
              ) : null}

              {/* Finish */}
              {book.shelf === 'reading' ? (
                <PressableScale
                  onPress={onFinish}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as finished"
                  style={[styles.finishButton, { backgroundColor: theme.accent }]}
                >
                  <Text style={styles.finishText}>Mark as finished</Text>
                </PressableScale>
              ) : null}

              {/* About — description + subjects from Open Library */}
              <AboutSection
                description={details?.description ?? null}
                subjects={details?.subjects ?? []}
                loading={detailsLoading}
              />

              <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Remove from library"
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
              >
                <Text style={[styles.deleteText, { color: theme.textSecondary }]}>
                  Remove from library
                </Text>
              </Pressable>
            </Animated.View>
          </Animated.ScrollView>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const n = label.replace('−', '-');
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.startsWith('-') ? 'Back' : 'Forward'} ${n.replace(/[+-]/, '')} pages`}
      style={[styles.stepper, { backgroundColor: theme.backgroundSelected }]}
    >
      <Text style={[styles.stepperText, { color: theme.text }]}>{label}</Text>
    </PressableScale>
  );
}

function TotalPagesEditor({
  total,
  onSet,
}: {
  total: number | null;
  onSet: (n: number | null) => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(total ? String(total) : '');

  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total pages</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        onEndEditing={() => {
          const n = parseInt(value, 10);
          onSet(Number.isFinite(n) && n > 0 ? n : null);
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        placeholder="—"
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.accent}
        cursorColor={theme.accent}
        style={[
          styles.totalInput,
          { backgroundColor: theme.backgroundSelected, color: theme.text },
        ]}
      />
    </View>
  );
}

/** Quick facts under the title: publish year · page count, plus a star rating. */
function BookFacts({
  year,
  pages,
  ratingAverage,
  ratingCount,
}: {
  year: number | null;
  pages: number | null;
  ratingAverage: number | null;
  ratingCount: number;
}) {
  const theme = useTheme();
  const facts: string[] = [];
  if (year) facts.push(String(year));
  if (pages) facts.push(`${pages} pages`);
  if (facts.length === 0 && ratingAverage == null) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(Motion.durations.base).reduceMotion(ReduceMotion.System)}
      style={styles.facts}
    >
      {facts.length > 0 ? (
        <View style={styles.factRow}>
          {facts.map((fact, i) => (
            <View key={fact} style={styles.factItem}>
              {i > 0 ? (
                <Text style={[styles.factDot, { color: theme.textSecondary }]}>·</Text>
              ) : null}
              <Text style={[styles.factText, { color: theme.textSecondary }]}>{fact}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {ratingAverage != null ? <Stars average={ratingAverage} count={ratingCount} /> : null}
    </Animated.View>
  );
}

function Stars({ average, count }: { average: number; count: number }) {
  const theme = useTheme();
  const rounded = Math.round(average);
  return (
    <View style={styles.starsRow}>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Text
            key={n}
            style={[styles.star, { color: n <= rounded ? theme.accent : theme.backgroundSelected }]}
          >
            ★
          </Text>
        ))}
      </View>
      <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
        {average.toFixed(1)}
        {count > 0 ? ` · ${count} rating${count === 1 ? '' : 's'}` : ''}
      </Text>
    </View>
  );
}

/** Description (expandable) + subject chips. Shows a skeleton on first fetch. */
function AboutSection({
  description,
  subjects,
  loading,
}: {
  description: string | null;
  subjects: string[];
  loading: boolean;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (loading && !description && subjects.length === 0) {
    return (
      <Paper style={styles.aboutCard}>
        <View
          style={[
            styles.skeleton,
            styles.skeletonLabel,
            { backgroundColor: theme.backgroundSelected },
          ]}
        />
        <View style={[styles.skeleton, { backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeleton, { backgroundColor: theme.backgroundSelected }]} />
        <View
          style={[
            styles.skeleton,
            styles.skeletonShort,
            { backgroundColor: theme.backgroundSelected },
          ]}
        />
      </Paper>
    );
  }

  if (!description && subjects.length === 0) return null;

  const long = (description?.length ?? 0) > 280;

  return (
    <Animated.View
      entering={FadeIn.duration(Motion.durations.base).reduceMotion(ReduceMotion.System)}
      style={styles.about}
    >
      {description ? (
        <Paper style={styles.aboutCard}>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>ABOUT</Text>
          <Text
            style={[styles.description, { color: theme.text }]}
            numberOfLines={expanded ? undefined : 6}
          >
            {description}
          </Text>
          {long ? (
            <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
              <Text style={[styles.readMore, { color: theme.accent }]}>
                {expanded ? 'Show less' : 'Read more'}
              </Text>
            </Pressable>
          ) : null}
        </Paper>
      ) : null}
      {subjects.length > 0 ? (
        <View style={styles.chips}>
          {subjects.map((subject) => (
            <View key={subject} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.chipText, { color: theme.textSecondary }]} numberOfLines={1}>
                {subject}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** "You read this" recap shown on the Finished shelf: date, days, pages. */
function FinishedSummary({
  finishedAt,
  startedAt,
  totalPages,
}: {
  finishedAt: string | null;
  startedAt: string | null;
  totalPages: number | null;
}) {
  const theme = useTheme();
  const days = daysToFinish(startedAt, finishedAt);
  const tiles: { value: string; label: string }[] = [];
  if (days != null) tiles.push({ value: String(days), label: days === 1 ? 'day' : 'days' });
  if (totalPages) tiles.push({ value: String(totalPages), label: 'pages' });

  return (
    <Paper style={styles.finishedCard}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>FINISHED</Text>
      {finishedAt ? (
        <Text style={[styles.finishedDate, { color: theme.text }]}>
          Finished {formatLongDate(finishedAt)}
        </Text>
      ) : null}
      {tiles.length > 0 ? (
        <View style={styles.statRow}>
          {tiles.map((tile) => (
            <View
              key={tile.label}
              style={[styles.statTile, { backgroundColor: theme.backgroundSelected }]}
            >
              <Text style={[styles.statValue, { color: theme.text }]}>{tile.value}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{tile.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Paper>
  );
}

const styles = StyleSheet.create({
  // Transparent root so the live shelf behind the (transparent-modal) screen
  // shows through as the page is dragged away.
  root: { flex: 1, backgroundColor: 'transparent' },
  // The page card itself; overflow hidden lets the corner radius clip on drag.
  page: { flex: 1, overflow: 'hidden' },
  scrim: { backgroundColor: '#000' },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  afterHero: { gap: Spacing.four },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  hero: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.two },
  heroMeta: { alignItems: 'center', gap: 2 },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  author: { fontFamily: FontFamily.regular, fontSize: 17, lineHeight: 22 },
  facts: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  factRow: { flexDirection: 'row', alignItems: 'center' },
  factItem: { flexDirection: 'row', alignItems: 'center' },
  factDot: { marginHorizontal: Spacing.two, fontSize: 14 },
  factText: { fontSize: 14, fontWeight: '500' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stars: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 16 },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  about: { gap: Spacing.three },
  aboutCard: { padding: Spacing.four, gap: Spacing.two },
  description: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 24 },
  readMore: { fontSize: 14, fontWeight: '700', marginTop: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderCurve: 'continuous',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  skeleton: { height: 12, borderRadius: 4, alignSelf: 'stretch' },
  skeletonLabel: { width: '28%', alignSelf: 'flex-start' },
  skeletonShort: { width: '55%' },
  segment: { flexDirection: 'row', gap: Spacing.two },
  segItem: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  segText: { fontSize: 14, fontWeight: '700' },
  cardLabel: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  progressCard: { padding: Spacing.four, gap: Spacing.three },
  finishedCard: { padding: Spacing.four, gap: Spacing.three },
  finishedDate: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
  },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  statTile: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: FontFamily.semibold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { fontSize: 13, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pageReadout: { flex: 1, alignItems: 'center' },
  pageNum: {
    fontFamily: FontFamily.semibold,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  pagePct: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  totalLabel: { fontSize: 15, fontWeight: '500' },
  totalInput: {
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
    fontVariant: ['tabular-nums'],
    fontSize: 16,
  },
  stepper: {
    width: 46,
    height: 40,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  finishButton: {
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
    borderCurve: 'continuous',
    alignItems: 'center',
    boxShadow: '0px 6px 16px rgba(60, 40, 25, 0.18)',
  },
  finishText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  sessionButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sessionText: { fontFamily: FontFamily.semibold, fontSize: 16 },
  deleteButton: { alignItems: 'center', paddingVertical: Spacing.two },
  deleteText: { fontSize: 15, fontWeight: '500' },
  pressed: { opacity: 0.7 },
});
