import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StreakDisplayProps = {
  weekStreak: number;
  frozen?: boolean;
};

/**
 * The streak — the thing the user is protecting (DESIGN-UI.md §7a). Big Fraunces
 * tabular-nums number so digits never reflow, with a warm headline beneath.
 */
export function StreakDisplay({ weekStreak, frozen = false }: StreakDisplayProps) {
  const theme = useTheme();
  const headline =
    weekStreak > 0
      ? `${weekStreak} week${weekStreak === 1 ? '' : 's'} strong`
      : 'Start your streak';

  return (
    <View style={styles.block}>
      <Text style={[styles.number, { color: theme.accent }]}>{weekStreak}</Text>
      <Text style={[styles.headline, { color: theme.text }]}>{headline}</Text>
      {frozen ? (
        <Text style={[styles.frozen, { color: theme.textSecondary }]}>
          ❄︎ This week is frozen
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
  },
  number: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.streak.fontSize,
    lineHeight: Type.streak.lineHeight,
    fontVariant: ['tabular-nums'],
  },
  headline: {
    fontFamily: FontFamily.medium,
    fontSize: Type.display.fontSize,
    lineHeight: Type.display.lineHeight,
  },
  frozen: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '500',
    marginTop: Spacing.one,
  },
});
