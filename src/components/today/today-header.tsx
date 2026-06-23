import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { formatWeekdayDate } from '@/lib/dates';
import { useTheme } from '@/hooks/use-theme';

export type TodayHeaderProps = {
  /** Today as a `YYYY-MM-DD` string. */
  today: string;
  onSettings: () => void;
};

/** Time-of-day greeting from the device wall clock. */
function greeting(hour = new Date().getHours()): string {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Today's header — a warm greeting and the date in place of a bare settings cog
 * (DESIGN-UI.md §6). Fraunces greeting over a quiet date line; settings tucked
 * to the right as a low-emphasis action, not a destination.
 */
export function TodayHeader({ today, onSettings }: TodayHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[styles.greeting, { color: theme.text }]}>{greeting()}</Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>
          {formatWeekdayDate(today)}
        </Text>
      </View>
      <IconButton
        name="settings-outline"
        accessibilityLabel="Settings"
        color={theme.textSecondary}
        onPress={onSettings}
        style={styles.settings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.headline.fontSize,
    lineHeight: Type.headline.lineHeight,
  },
  date: {
    fontSize: Type.caption.fontSize,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '500',
  },
  settings: {
    marginRight: -Spacing.two,
    marginTop: -Spacing.one,
  },
});
