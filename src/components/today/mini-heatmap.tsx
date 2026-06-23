import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, mondayOf, mondaysInRange, weekDates } from '@/lib/dates';

const MINI_WEEKS = 5;

export type MiniHeatmapProps = {
  /** date → pages (or 1 if marked without pages), from `computeStats`. */
  heatmap: Record<string, number>;
  today: string;
};

/**
 * A glanceable ~5-week taste of the reading quilt (DESIGN-UI.md §6 #5) — the
 * full year lives in Stats (progressive disclosure), so the whole strip is a
 * link there. Clay cells warm with pages read; future days stay blank.
 */
export function MiniHeatmap({ heatmap, today }: MiniHeatmapProps) {
  const theme = useTheme();
  const end = mondayOf(today);
  const start = addDays(end, -7 * (MINI_WEEKS - 1));
  const weeks = mondaysInRange(start, end);
  const max = Math.max(1, ...Object.values(heatmap));

  return (
    <Link href={'/stats' as Href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="This month's reading — open Stats"
        style={({ pressed }) => [styles.block, pressed && styles.pressed]}>
        <View style={styles.headerRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>THIS MONTH</Text>
          <Text style={[styles.seeAll, { color: theme.accent }]}>See all</Text>
        </View>

        <View style={styles.grid}>
          {weeks.map((monday) => (
            <View key={monday} style={styles.col}>
              {weekDates(monday).map((date) => {
                const future = date > today;
                const intensity = heatmap[date] ?? 0;
                const ratio = intensity / max;
                return (
                  <View
                    key={date}
                    style={[
                      styles.cell,
                      future
                        ? styles.future
                        : intensity > 0
                          ? { backgroundColor: theme.accent, opacity: 0.3 + 0.7 * ratio }
                          : { backgroundColor: theme.backgroundSelected },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </Pressable>
    </Link>
  );
}

const CELL = 14;

const styles = StyleSheet.create({
  block: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  pressed: { opacity: 0.7 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  seeAll: { fontFamily: FontFamily.medium, fontSize: 14 },
  grid: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  col: {
    gap: Spacing.one,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 4,
    borderCurve: 'continuous',
  },
  future: { backgroundColor: 'transparent' },
});
