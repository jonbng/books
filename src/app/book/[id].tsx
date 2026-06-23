import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BookCover } from '@/components/book-cover';
import { useCelebration } from '@/components/celebration/celebration-provider';
import { Paper, PaperBackground } from '@/components/paper';
import { ScreenHeader } from '@/components/screen-header';
import { FontFamily, Motion, Spacing, Type } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useBookDetails } from '@/hooks/use-book-details';
import { useTheme } from '@/hooks/use-theme';
import { daysToFinish, readingPercent, SHELF_LABELS, type Shelf } from '@/lib/books';
import { formatLongDate } from '@/lib/dates';

const SHELF_ORDER: Shelf[] = ['want_to_read', 'reading', 'finished'];

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAppData();
  const theme = useTheme();
  const { celebrate } = useCelebration();
  const book = data.books.find((b) => b.id === Number(id));
  const { details, loading: detailsLoading } = useBookDetails(book?.openLibraryKey ?? null);

  // Open animation: the cover springs up into place while title/author rise in
  // just behind it — the book "arrives" on the page (DESIGN-UI.md motion).
  const reduced = useReducedMotion();
  const enter = useSharedValue(reduced ? 1 : 0);
  const meta = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    enter.set(withSpring(1, { ...Motion.successSpring, reduceMotion: ReduceMotion.System }));
    meta.set(
      withDelay(
        90,
        withTiming(1, {
          duration: Motion.durations.base,
          easing: Easing.bezier(...Motion.easingBezier),
          reduceMotion: ReduceMotion.System,
        })
      )
    );
  }, [enter, meta]);

  const coverStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.get() * 1.4),
    transform: [{ scale: 0.84 + 0.16 * enter.get() }, { translateY: (1 - enter.get()) * 40 }],
  }));
  const metaStyle = useAnimatedStyle(() => ({
    opacity: meta.get(),
    transform: [{ translateY: (1 - meta.get()) * 10 }],
  }));

  if (!book) {
    return (
      <PaperBackground>
        <ScreenHeader title="" />
        <View style={styles.missing}>
          <Text style={{ color: theme.textSecondary }}>This book is no longer on your shelf.</Text>
        </View>
      </PaperBackground>
    );
  }

  const percent = readingPercent(book.currentPage, book.totalPages);

  async function onMove(shelf: Shelf) {
    if (!book || shelf === book.shelf) return;
    await Haptics.selectionAsync();
    await data.moveBookToShelf(book.id, shelf);
  }

  async function onFinish() {
    if (!book) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await data.finishBook(book.id);
    celebrate({ kind: 'book-finished', book });
  }

  async function onStartSession() {
    if (!book) return;
    // If a session is already running, this button reads "Resume" and just
    // returns to it (starting a second would violate the one-active invariant).
    if (!data.activeSession) await data.startSession(book.id);
    router.push('/session');
  }

  function changePage(delta: number) {
    if (!book) return;
    const max = book.totalPages ?? Number.MAX_SAFE_INTEGER;
    const next = Math.max(0, Math.min(max, book.currentPage + delta));
    void data.setBookProgress(book.id, next);
  }

  async function onDelete() {
    if (!book) return;
    await data.deleteBook(book.id);
    router.back();
  }

  return (
    <PaperBackground>
      <ScreenHeader title="" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Animated.View style={coverStyle}>
            <BookCover
              coverUrl={book.coverUrl}
              coverWidth={book.coverWidth}
              coverHeight={book.coverHeight}
              height={248}
              elevation="hero"
            />
          </Animated.View>
          <Animated.View style={[styles.heroMeta, metaStyle]}>
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

        {/* Shelf status */}
        <View style={styles.segment}>
          {SHELF_ORDER.map((shelf) => {
            const active = shelf === book.shelf;
            return (
              <Pressable
                key={shelf}
                onPress={() => onMove(shelf)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={SHELF_LABELS[shelf]}
                style={({ pressed }) => [
                  styles.segItem,
                  { backgroundColor: active ? theme.accent : theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.segText,
                    { color: active ? '#FFFFFF' : theme.textSecondary },
                  ]}
                  numberOfLines={1}>
                  {SHELF_LABELS[shelf]}
                </Text>
              </Pressable>
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
              <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.accent }]} />
            </View>
            <TotalPagesEditor
              total={book.totalPages}
              onSet={(n) => data.setBookTotalPages(book.id, n)}
            />
          </Paper>
        ) : null}

        {/* Start / resume a timed session — hidden if a session for another book
            is running, since only one can be active at a time. */}
        {book.shelf === 'reading' &&
        (!data.activeSession || data.activeSession.bookId === book.id) ? (
          <Pressable
            onPress={onStartSession}
            accessibilityRole="button"
            accessibilityLabel={
              data.activeSession?.bookId === book.id
                ? 'Resume reading session'
                : 'Start reading session'
            }
            style={({ pressed }) => [
              styles.sessionButton,
              { borderColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.sessionText, { color: theme.accent }]}>
              {data.activeSession?.bookId === book.id
                ? 'Resume reading session'
                : 'Start reading session'}
            </Text>
          </Pressable>
        ) : null}

        {/* Finish */}
        {book.shelf === 'reading' ? (
          <Pressable
            onPress={onFinish}
            accessibilityRole="button"
            accessibilityLabel="Mark as finished"
            style={({ pressed }) => [
              styles.finishButton,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <Text style={styles.finishText}>Mark as finished</Text>
          </Pressable>
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
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <Text style={[styles.deleteText, { color: theme.textSecondary }]}>
            Remove from library
          </Text>
        </Pressable>
      </ScrollView>
    </PaperBackground>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const n = label.replace('−', '-');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.startsWith('-') ? 'Back' : 'Forward'} ${n.replace(/[+-]/, '')} pages`}
      style={({ pressed }) => [
        styles.stepper,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.stepperText, { color: theme.text }]}>{label}</Text>
    </Pressable>
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
        style={[styles.totalInput, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
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
      style={styles.facts}>
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
            style={[styles.star, { color: n <= rounded ? theme.accent : theme.backgroundSelected }]}>
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
        <View style={[styles.skeleton, styles.skeletonLabel, { backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeleton, { backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeleton, { backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeleton, styles.skeletonShort, { backgroundColor: theme.backgroundSelected }]} />
      </Paper>
    );
  }

  if (!description && subjects.length === 0) return null;

  const long = (description?.length ?? 0) > 280;

  return (
    <Animated.View
      entering={FadeIn.duration(Motion.durations.base).reduceMotion(ReduceMotion.System)}
      style={styles.about}>
      {description ? (
        <Paper style={styles.aboutCard}>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>ABOUT</Text>
          <Text
            style={[styles.description, { color: theme.text }]}
            numberOfLines={expanded ? undefined : 6}>
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
              style={[styles.statTile, { backgroundColor: theme.backgroundSelected }]}>
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
  content: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
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
  ratingText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
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
  finishedDate: { fontFamily: FontFamily.semibold, fontSize: 18, lineHeight: 24 },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  statTile: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontFamily: FontFamily.semibold, fontSize: 24, fontVariant: ['tabular-nums'] },
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
  stepperText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
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
