import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { dayOfReading } from '@/lib/books';

/**
 * The always-present gentle nudge that warms from the paper below
 * (DESIGN-UI.md §6 #6) — rendered inside `NativeTabs.BottomAccessory` (iOS 26+).
 * Reads the shared store rather than holding local state, since the accessory
 * can mount more than one instance. Tapping it returns to Today.
 */
export function NudgePill() {
  const theme = useTheme();
  const { ready, streak, booksByShelf, today } = useAppData();
  if (!ready) return null;

  const readToday = streak?.readToday ?? false;
  const book = booksByShelf.reading[0] ?? null;
  const day = book ? dayOfReading(book.startedAt, today) : null;

  const prompt = readToday ? 'You read today' : 'Did you read today?';
  const context = book ? (day ? `Day ${day} of ${book.title}` : book.title) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={context ? `${prompt} · ${context}` : prompt}
      onPress={() => router.navigate('/')}
      style={styles.row}>
      <Ionicons
        name={readToday ? 'checkmark-circle' : 'book-outline'}
        size={16}
        color={theme.accent}
      />
      <Text style={[styles.prompt, { color: theme.text }]} numberOfLines={1}>
        {prompt}
        {context ? (
          <Text style={{ color: theme.textSecondary }}>{`  ·  ${context}`}</Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  prompt: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
