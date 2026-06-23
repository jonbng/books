import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { FontFamily, Motion, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { weekDates } from '@/lib/dates';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export type WeekDotsProps = {
  monday: string;
  readDays: string[];
  today: string;
  daysRead: number;
  weeklyTarget: number;
  goalHit: boolean;
};

/**
 * This week's seven Mon–Sun dots (DESIGN-UI.md §7a) — daily satisfaction inside
 * the forgiving weekly frame. Each dot springs to a clay fill when its day is
 * read; today carries a ring until filled.
 */
export function WeekDots({
  monday,
  readDays,
  today,
  daysRead,
  weeklyTarget,
  goalHit,
}: WeekDotsProps) {
  const theme = useTheme();
  const readSet = new Set(readDays);

  return (
    <View style={styles.card}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>THIS WEEK</Text>
      <View style={styles.row}>
        {weekDates(monday).map((date, i) => (
          <View key={date} style={styles.column}>
            <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>
              {WEEKDAY_LABELS[i]}
            </Text>
            <Dot read={readSet.has(date)} isToday={date === today} />
          </View>
        ))}
      </View>
      <Text style={[styles.summary, { color: theme.textSecondary }]}>
        {daysRead} of {weeklyTarget} days{goalHit ? ' — goal hit 🎉' : ''}
      </Text>
    </View>
  );
}

function Dot({ read, isToday }: { read: boolean; isToday: boolean }) {
  const theme = useTheme();
  const v = useSharedValue(read ? 1 : 0);

  useEffect(() => {
    v.set(
      withSpring(read ? 1 : 0, {
        ...Motion.successSpring,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [read, v]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      v.get(),
      [0, 1],
      [theme.backgroundSelected, theme.accent]
    ),
    transform: [{ scale: 0.85 + 0.15 * v.get() }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        style,
        isToday && !read ? { borderWidth: 2, borderColor: theme.accent } : null,
      ]}
    />
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  label: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  summary: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
  },
});
