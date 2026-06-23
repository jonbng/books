import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { BookCover } from '@/components/book-cover';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';

/**
 * The finish-a-book payoff (DESIGN.md §8) — a full warm-paper takeover: the cover
 * springs up inside a terracotta glow, Fraunces "Finished", and the year count.
 * The Success haptic already fired at the finish tap; tap anywhere to continue.
 */
export function BookFinishedCelebration({
  book,
  onDismiss,
}: {
  book: Book;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { stats } = useAppData();
  const count = stats?.booksFinishedThisYear ?? 0;

  return (
    <Pressable
      style={[styles.scrim, { backgroundColor: theme.background }]}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={`Finished. ${count} ${count === 1 ? 'book' : 'books'} this year. Tap to continue.`}>

      <Animated.View
        entering={ZoomIn.springify().damping(15).stiffness(150).reduceMotion(ReduceMotion.System)}
        style={styles.stage}>
        <View style={[styles.glow, { backgroundColor: theme.accent }]} />
        <BookCover
          coverUrl={book.coverUrl}
          coverWidth={book.coverWidth}
          coverHeight={book.coverHeight}
          height={210}
          elevation="hero"
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(160).duration(280).reduceMotion(ReduceMotion.System)}
        style={styles.textBlock}>
        <Text style={[styles.finished, { color: theme.text }]}>Finished</Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {count} {count === 1 ? 'book' : 'books'} this year
        </Text>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.delay(800).duration(400)}
        style={[styles.hint, { color: theme.textSecondary }]}>
        Tap to continue
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.five },
  stage: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.16,
  },
  textBlock: { alignItems: 'center', gap: Spacing.one },
  finished: {
    fontFamily: FontFamily.semibold,
    fontSize: 40,
    lineHeight: 46,
  },
  count: {
    fontSize: Type.body.fontSize,
    lineHeight: Type.body.lineHeight,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    position: 'absolute',
    bottom: Spacing.six,
    fontSize: 14,
    fontWeight: '500',
  },
});
