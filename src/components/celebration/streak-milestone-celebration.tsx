import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The streak-milestone badge (DESIGN.md §8) — a lighter moment than finishing a
 * book: a flame in a terracotta glow + Fraunces "N weeks strong". Fires its own
 * Success haptic (no tap triggered it) and auto-dismisses after a short beat.
 */
export function StreakMilestoneCelebration({
  weeks,
  onDismiss,
}: {
  weeks: number;
  onDismiss: () => void;
}) {
  const theme = useTheme();

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(onDismiss, 2600);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <Pressable
      style={[styles.scrim, { backgroundColor: theme.background }]}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={`${weeks} weeks strong. Tap to continue.`}>

      <Animated.View
        entering={ZoomIn.springify().damping(15).stiffness(150).reduceMotion(ReduceMotion.System)}
        style={styles.stage}>
        <View style={[styles.glow, { backgroundColor: theme.accent }]} />
        <Ionicons name="flame" size={88} color={theme.accent} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(280).reduceMotion(ReduceMotion.System)}>
        <Text style={[styles.headline, { color: theme.text }]}>{weeks} weeks strong</Text>
      </Animated.View>

      <Animated.Text
        entering={FadeIn.delay(800).duration(400)}
        style={[styles.hint, { color: theme.textSecondary }]}>
        Keep it going
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  stage: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.16,
  },
  headline: {
    fontFamily: FontFamily.semibold,
    fontSize: 36,
    lineHeight: 42,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    position: 'absolute',
    bottom: Spacing.six,
    fontSize: 14,
    fontWeight: '500',
  },
});
