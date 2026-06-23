import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  label: string;
  onPress: () => void;
  /** `primary` = clay fill; `ghost` = quiet text-only (e.g. "Maybe later"). */
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
};

/**
 * Onboarding CTA. Spring press-scale to 0.96 for tactile feedback (DESIGN-UI §5).
 * No haptic on press — haptics are rationed to book-add and the finish.
 */
export function OnboardingButton({ label, onPress, variant = 'primary', disabled }: Props) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed ? 0.96 : 1, { dampingRatio: 0.8, duration: 0.18 }) }],
  }));

  const isPrimary = variant === 'primary';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[
        styles.button,
        animatedStyle,
        isPrimary
          ? { backgroundColor: theme.accent, boxShadow: '0 6px 16px rgba(60, 40, 25, 0.18)' }
          : { backgroundColor: 'transparent' },
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.label, { color: isPrimary ? theme.background : theme.textSecondary }]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    paddingHorizontal: Spacing.five,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
});
