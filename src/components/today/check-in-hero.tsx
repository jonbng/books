import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Elevation, FontFamily, Motion, Spacing, Type } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CheckInHeroProps = {
  readToday: boolean;
  /** Marks/unmarks today. The store reload flips `readToday` back to us. */
  onToggle: () => void | Promise<void>;
  /** Active books, used for the "which book" chip in the detail reveal. */
  readingBooks: Book[];
  /** Today's logged detail (pages / attributed book), null until marked. */
  todayDetail: { pages: number | null; bookId: number | null } | null;
  /** Persist an edit to today's detail without un-marking. */
  onLogDetail: (detail: { pages?: number | null; bookId?: number | null }) => void | Promise<void>;
};

/**
 * The day-mark hero — the emotional core and most-tapped surface in the app
 * (DESIGN-UI.md §6). A tactile paper element: the whole card springs to 0.96 on
 * press and settles back; a clay circle fills with a checkmark; a haptic fires.
 *
 * Detail-optional core loop (DESIGN-UI.md §6): the tap confirms instantly, then
 * the card grows in place to reveal a pages stepper and a "which book" chip —
 * never blocking the checkmark. Once marked the primary surface is satisfied,
 * not a dead button; undo is a quiet secondary affordance.
 */
export function CheckInHero({
  readToday,
  onToggle,
  readingBooks,
  todayDetail,
  onLogDetail,
}: CheckInHeroProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  const scale = useSharedValue(1);
  const fill = useSharedValue(readToday ? 1 : 0);

  // Keep the fill in sync with the source-of-truth state (e.g. toggled elsewhere).
  useEffect(() => {
    fill.set(
      withSpring(readToday ? 1 : 0, {
        ...Motion.successSpring,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [readToday, fill]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.get(),
    transform: [{ scale: 0.5 + 0.5 * fill.get() }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: fill.get(),
    transform: [{ scale: 0.4 + 0.6 * fill.get() }],
  }));

  const onPressIn = () => {
    if (reduced || readToday) return;
    scale.set(withSpring(0.96, Motion.pressSpring));
  };
  const onPressOut = () => {
    if (readToday) return;
    scale.set(withSpring(1, Motion.successSpring));
  };

  const mark = async () => {
    // Optimistic fill for snappiness; the effect reconciles to true state.
    fill.set(
      withSpring(1, { ...Motion.successSpring, reduceMotion: ReduceMotion.System })
    );
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onToggle();
  };

  const undo = async () => {
    fill.set(
      withSpring(0, { ...Motion.successSpring, reduceMotion: ReduceMotion.System })
    );
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await onToggle();
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ checked: readToday }}
      accessibilityLabel={readToday ? 'You read today' : 'Mark today as read'}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={readToday ? undefined : mark}
      layout={LinearTransition.duration(Motion.durations.base).reduceMotion(ReduceMotion.System)}
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, boxShadow: Elevation.hero },
        cardStyle,
      ]}>
      <View style={styles.headRow}>
        <View style={[styles.mark, { borderColor: theme.accent }]}>
          <Animated.View
            style={[styles.markFill, { backgroundColor: theme.accent }, fillStyle]}
          />
          <Animated.Text style={[styles.check, checkStyle]}>✓</Animated.Text>
        </View>

        <View style={styles.labelBlock}>
          <Text style={[styles.title, { color: theme.text }]}>
            {readToday ? 'You read today' : 'I read today'}
          </Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {readToday ? 'Nice work — keep it going' : 'One tap keeps the streak alive'}
          </Text>
        </View>

        {readToday ? (
          <Pressable
            onPress={undo}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Undo today's reading"
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={[styles.undo, { color: theme.textSecondary }]}>Undo</Text>
          </Pressable>
        ) : null}
      </View>

      {readToday ? (
        <Animated.View
          entering={FadeIn.duration(Motion.durations.base).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(Motion.durations.fast).reduceMotion(ReduceMotion.System)}
          style={[styles.detail, { borderTopColor: theme.backgroundSelected }]}>
          <DetailEditor
            readingBooks={readingBooks}
            todayDetail={todayDetail}
            onLogDetail={onLogDetail}
          />
        </Animated.View>
      ) : null}
    </AnimatedPressable>
  );
}

// Pages-read is a rough estimate, not an exact page number (that's edited on the
// book's own screen — see DESIGN-UI.md §"Book detail"), so the stepper moves in
// fives: a few taps cover a typical session without a 30-tap crawl from zero.
const PAGE_STEP = 5;

/** The optional "what did you read" controls revealed after a check-in. */
function DetailEditor({
  readingBooks,
  todayDetail,
  onLogDetail,
}: Pick<CheckInHeroProps, 'readingBooks' | 'todayDetail' | 'onLogDetail'>) {
  const theme = useTheme();
  const [pages, setPages] = useState(todayDetail?.pages ?? 0);
  const [bookId, setBookId] = useState<number | null>(
    todayDetail?.bookId ?? readingBooks[0]?.id ?? null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The editor is this surface's only writer for its lifetime: it mounts with
  // the store-confirmed detail (above) and remounts fresh after an undo, so no
  // store→local sync effect is needed — only the pending-commit cleanup.
  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    []
  );

  const step = (delta: number) => {
    const next = Math.max(0, pages + delta);
    setPages(next);
    Haptics.selectionAsync().catch(() => {});
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => void onLogDetail({ pages: next }), 600);
  };

  const selectBook = (id: number) => {
    setBookId(id);
    setPickerOpen(false);
    Haptics.selectionAsync().catch(() => {});
    void onLogDetail({ bookId: id });
  };

  const selected = readingBooks.find((b) => b.id === bookId) ?? readingBooks[0];

  return (
    <View style={styles.editor}>
      <View style={styles.stepperRow}>
        <StepButton label="−" onPress={() => step(-PAGE_STEP)} disabled={pages <= 0} />
        <View style={styles.pagesValue}>
          <Text style={[styles.pagesNumber, { color: theme.text }]}>{pages}</Text>
          <Text style={[styles.pagesUnit, { color: theme.textSecondary }]}>pages</Text>
        </View>
        <StepButton label="+" onPress={() => step(PAGE_STEP)} />
      </View>

      {selected ? (
        <View>
          <Pressable
            onPress={() => readingBooks.length > 1 && setPickerOpen((o) => !o)}
            hitSlop={6}
            accessibilityRole={readingBooks.length > 1 ? 'button' : 'text'}
            accessibilityLabel={`Read from ${selected.title}`}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: theme.backgroundSelected },
              pressed && readingBooks.length > 1 && styles.pressed,
            ]}>
            <Ionicons name="book-outline" size={15} color={theme.textSecondary} />
            <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
              {selected.title}
            </Text>
            {readingBooks.length > 1 ? (
              <Ionicons
                name={pickerOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.textSecondary}
              />
            ) : null}
          </Pressable>

          {pickerOpen ? (
            <Animated.View
              entering={FadeIn.duration(Motion.durations.fast)}
              style={styles.picker}>
              {readingBooks.map((book) => (
                <Pressable
                  key={book.id}
                  onPress={() => selectBook(book.id)}
                  style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
                  <Text
                    style={[
                      styles.pickerText,
                      { color: book.id === selected.id ? theme.accent : theme.text },
                    ]}
                    numberOfLines={1}>
                    {book.title}
                  </Text>
                  {book.id === selected.id ? (
                    <Ionicons name="checkmark" size={16} color={theme.accent} />
                  ) : null}
                </Pressable>
              ))}
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Add a page' : 'Remove a page'}
      style={({ pressed }) => [
        styles.step,
        { borderColor: theme.backgroundSelected },
        pressed && styles.pressed,
        disabled && styles.stepDisabled,
      ]}>
      <Text style={[styles.stepLabel, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

const MARK_SIZE = 56;
const STEP_SIZE = 40;

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.five,
    borderCurve: 'continuous',
    gap: Spacing.three,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: MARK_SIZE / 2,
  },
  check: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.headline.fontSize,
    lineHeight: Type.headline.lineHeight,
  },
  sub: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '500',
  },
  undo: {
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: { opacity: 0.6 },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  editor: {
    gap: Spacing.three,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  step: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderRadius: STEP_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  stepLabel: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
  },
  pagesValue: {
    minWidth: 76,
    alignItems: 'center',
  },
  pagesNumber: {
    fontFamily: FontFamily.semibold,
    fontSize: 28,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  pagesUnit: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    maxWidth: '100%',
  },
  chipText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  picker: {
    marginTop: Spacing.two,
    gap: 2,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  pickerText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
