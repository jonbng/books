import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Paper } from '@/components/paper';
import { PressableScale } from '@/components/pressable-scale';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import type { ReadingSession } from '@/db/sessions-repo';
import { useSessionTimer } from '@/hooks/use-session-timer';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/sessions';

/**
 * The "you have a session running" card at the top of Today. Survives an app
 * relaunch because the active session is persisted and reloaded on foreground;
 * the elapsed time is recomputed from the start timestamp, so it's correct even
 * after hours away. Tapping it returns to the live timer.
 */
export function ActiveSessionStrip({
  session,
  book,
}: {
  session: ReadingSession;
  book: Book | null;
}) {
  const theme = useTheme();
  const elapsed = useSessionTimer(session.startedAt);

  return (
    <PressableScale
      onPress={() => router.push('/session')}
      accessibilityRole="button"
      accessibilityLabel="Return to your reading session">
      <Paper elevation="raised" style={styles.card}>
        {book ? (
          <BookCover
            coverUrl={book.coverUrl}
            coverWidth={book.coverWidth}
            coverHeight={book.coverHeight}
            height={56}
          />
        ) : null}
        <View style={styles.meta}>
          <Text style={[styles.label, { color: theme.accent }]}>SESSION IN PROGRESS</Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {book?.title ?? 'Reading'}
          </Text>
        </View>
        <Text style={[styles.clock, { color: theme.text }]}>{formatDuration(elapsed)}</Text>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </Paper>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  meta: { flex: 1, gap: 2 },
  label: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  title: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 21 },
  clock: {
    fontFamily: FontFamily.semibold,
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
});
