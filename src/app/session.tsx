import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { PaperBackground } from '@/components/paper';
import { ScreenHeader } from '@/components/screen-header';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useSessionTimer } from '@/hooks/use-session-timer';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/sessions';

// Pages move in fives, like the Today check-in stepper — a few taps cover a
// typical session without a long crawl from zero (see check-in-hero.tsx).
const PAGE_STEP = 5;

type Phase = 'running' | 'finishing';

/**
 * The live reading-session screen — a focused, dismissible modal (not a stack
 * destination). While `running` it shows a calm, slow clock for the active book;
 * `finishing` swaps in a pages stepper. Saving folds the session into the book's
 * progress and today's reading (see sessions-repo.finishSession).
 *
 * No per-second animation or haptics on the clock: a haptic that fires every
 * second would blow the app's three-moments ration (DESIGN-UI §5). The one
 * haptic here is the Success on save.
 */
export default function SessionScreen() {
  const data = useAppData();
  const theme = useTheme();
  const { activeSession } = data;
  const elapsed = useSessionTimer(activeSession?.startedAt ?? null);

  const [phase, setPhase] = useState<Phase>('running');
  const [pages, setPages] = useState(0);
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

  const step = (delta: number) => {
    setPages((p) => Math.max(0, p + delta));
    Haptics.selectionAsync().catch(() => {});
  };

  const save = async () => {
    acting.current = true;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await data.finishSession(pages);
    router.back();
  };

  const cancel = () => {
    Alert.alert('Discard this session?', 'The time and pages for this session won’t be saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          acting.current = true;
          await data.cancelSession();
          router.back();
        },
      },
    ]);
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
        ) : (
          <>
            <View style={styles.clockBlock}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {formatDuration(elapsed)} · HOW MANY PAGES?
              </Text>
              <View style={styles.stepperRow}>
                <StepButton label="−" onPress={() => step(-PAGE_STEP)} disabled={pages <= 0} />
                <View style={styles.pagesValue}>
                  <Text style={[styles.pagesNumber, { color: theme.text }]}>{pages}</Text>
                  <Text style={[styles.pagesUnit, { color: theme.textSecondary }]}>pages</Text>
                </View>
                <StepButton label="+" onPress={() => step(PAGE_STEP)} />
              </View>
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
      accessibilityLabel={label === '+' ? 'Add five pages' : 'Remove five pages'}
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

const STEP_SIZE = 48;

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
  },
  clock: {
    fontFamily: FontFamily.semibold,
    fontSize: 72,
    lineHeight: 80,
    fontVariant: ['tabular-nums'],
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
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
  stepLabel: { fontSize: 26, lineHeight: 28, fontWeight: '600' },
  pagesValue: { minWidth: 96, alignItems: 'center' },
  pagesNumber: {
    fontFamily: FontFamily.semibold,
    fontSize: 44,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  pagesUnit: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actions: { alignSelf: 'stretch', gap: Spacing.two },
  primary: {
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
    borderCurve: 'continuous',
    alignItems: 'center',
    boxShadow: '0px 6px 16px rgba(60, 40, 25, 0.18)',
  },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  secondary: { alignItems: 'center', paddingVertical: Spacing.three },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
