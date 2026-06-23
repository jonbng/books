import { Link, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Paper, PaperBackground } from '@/components/paper';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useStatusBarInset } from '@/hooks/use-status-bar-inset';
import { useTheme } from '@/hooks/use-theme';
import { addDays, daysBetween, mondaysInRange, mondayOf, weekDates, yearOf } from '@/lib/dates';
import { formatDurationCompact } from '@/lib/sessions';

const HEATMAP_WEEKS = 17;

export default function StatsScreen() {
  const { stats, streak, today, availableFreezes, sessionStats } = useAppData();
  const theme = useTheme();
  const topInset = useStatusBarInset();

  if (!stats || !streak) {
    return (
      <PaperBackground style={styles.loading}>
        <Text style={{ color: theme.textSecondary }}>Loading…</Text>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: Spacing.four + topInset }]}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Stats</Text>
        {stats.totalReadingDays === 0 && stats.booksFinished === 0 ? (
          <Text style={[styles.emptyNote, { color: theme.textSecondary }]}>
            Nothing to show yet — mark a day on Today and your reading quilt starts filling in.
          </Text>
        ) : null}

        <YearlyGoalCard
          finished={stats.booksFinishedThisYear}
          goal={stats.yearlyGoal}
          today={today}
        />

        <Heatmap heatmap={stats.heatmap} today={today} />

        <View style={styles.grid}>
          <StatCard label="WEEK STREAK" value={streak.weekStreak} />
          <StatCard label="LONGEST STREAK" value={streak.longestStreak} />
          <StatCard label="BOOKS FINISHED" value={stats.booksFinished} href={'/shelf' as Href} />
          <StatCard label="READING DAYS" value={stats.totalReadingDays} />
          <StatCard label="PAGES READ" value={stats.totalPages} />
          <StatCard label="AVG PAGES / DAY" value={stats.averagePagesPerReadingDay} />
        </View>

        {sessionStats && sessionStats.sessionCount > 0 ? (
          <View style={styles.grid}>
            <StatCard label="TIME READ" value={formatDurationCompact(sessionStats.totalSeconds)} />
            <StatCard
              label="TIME THIS YEAR"
              value={formatDurationCompact(sessionStats.secondsThisYear)}
            />
            <StatCard label="SESSIONS" value={sessionStats.sessionCount} />
            <StatCard
              label="AVG SESSION"
              value={formatDurationCompact(sessionStats.averageSessionSeconds)}
            />
          </View>
        ) : null}

        <Text style={[styles.footnote, { color: theme.textSecondary }]}>
          {availableFreezes > 0
            ? `❄︎ ${availableFreezes} freeze${availableFreezes === 1 ? '' : 's'} banked — a missed week is covered automatically.`
            : 'Keep a 2-week streak going to bank a freeze that protects a missed week.'}
        </Text>
      </ScrollView>
    </PaperBackground>
  );
}

function YearlyGoalCard({
  finished,
  goal,
  today,
}: {
  finished: number;
  goal: number | null;
  today: string;
}) {
  const theme = useTheme();

  if (!goal || goal <= 0) {
    return (
      <Link href={'/settings' as Href} asChild>
        <Paper style={styles.goalCard}>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>THIS YEAR</Text>
          <Text style={[styles.goalBig, { color: theme.text }]}>
            {finished} book{finished === 1 ? '' : 's'} finished
          </Text>
          <Text style={[styles.goalNote, { color: theme.accent }]}>Set a yearly goal →</Text>
        </Paper>
      </Link>
    );
  }

  const pct = Math.min(100, Math.round((finished / goal) * 100));
  // Pace framing — encouraging, never "behind".
  const jan1 = `${yearOf(today)}-01-01`;
  const fractionOfYear = Math.min(1, (daysBetween(jan1, today) + 1) / 365);
  const expected = goal * fractionOfYear;
  const note =
    finished >= expected + 0.5
      ? 'ahead of pace 🌱'
      : finished >= expected - 0.5
        ? 'right on track'
        : `on the way — ${goal - finished} to go`;

  return (
    <Paper style={styles.goalCard}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>THIS YEAR</Text>
      <View style={styles.goalRow}>
        <Text style={[styles.goalBig, { color: theme.text }]}>{finished}</Text>
        <Text style={[styles.goalOf, { color: theme.textSecondary }]}>of {goal} books</Text>
      </View>
      <View style={[styles.goalTrack, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.goalFill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
      </View>
      <Text style={[styles.goalNote, { color: theme.textSecondary }]}>{note}</Text>
    </Paper>
  );
}

/** The cozy quilt — a calendar grid filling clay as the weeks are read. */
function Heatmap({ heatmap, today }: { heatmap: Record<string, number>; today: string }) {
  const theme = useTheme();
  const end = mondayOf(today);
  const start = addDays(end, -7 * (HEATMAP_WEEKS - 1));
  const weeks = mondaysInRange(start, end);
  const max = Math.max(1, ...Object.values(heatmap));

  return (
    <Paper style={styles.heatCard}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>READING DAYS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.heatGrid}>
          {weeks.map((monday) => (
            <View key={monday} style={styles.heatCol}>
              {weekDates(monday).map((date) => {
                const future = date > today;
                const intensity = heatmap[date] ?? 0;
                const ratio = intensity / max;
                return (
                  <View
                    key={date}
                    style={[
                      styles.heatCell,
                      future
                        ? { backgroundColor: 'transparent' }
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
      </ScrollView>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>Less</Text>
        <View style={[styles.heatCell, styles.legendCell, { backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.heatCell, styles.legendCell, { backgroundColor: theme.accent, opacity: 0.45 }]} />
        <View style={[styles.heatCell, styles.legendCell, { backgroundColor: theme.accent, opacity: 0.75 }]} />
        <View style={[styles.heatCell, styles.legendCell, { backgroundColor: theme.accent }]} />
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>More</Text>
      </View>
    </Paper>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: Href;
}) {
  const theme = useTheme();
  const card = (
    <Paper style={styles.statCard}>
      <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </Paper>
  );
  if (!href) return card;
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => [styles.statLink, pressed && styles.pressed]}>
        {card}
      </Pressable>
    </Link>
  );
}

const CELL = 13;

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },
  screenTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.display.fontSize,
    lineHeight: Type.display.lineHeight,
  },
  cardLabel: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  goalCard: { padding: Spacing.four, gap: Spacing.three },
  goalRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  goalBig: {
    fontFamily: FontFamily.semibold,
    fontSize: 40,
    lineHeight: 44,
    fontVariant: ['tabular-nums'],
  },
  goalOf: { fontFamily: FontFamily.regular, fontSize: 18 },
  goalTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 4 },
  goalNote: { fontFamily: FontFamily.medium, fontSize: 15, lineHeight: 20 },
  heatCard: { padding: Spacing.four, gap: Spacing.three },
  heatGrid: { flexDirection: 'row', gap: 3, paddingVertical: Spacing.one },
  heatCol: { gap: 3 },
  heatCell: { width: CELL, height: CELL, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendCell: { marginHorizontal: 1 },
  legendText: { fontSize: 12, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  statLink: { flexGrow: 1, flexBasis: '44%' },
  pressed: { opacity: 0.7 },
  statCard: {
    flexGrow: 1,
    flexBasis: '44%',
    padding: Spacing.four,
    gap: Spacing.one,
  },
  statValue: {
    fontFamily: FontFamily.semibold,
    fontSize: 34,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  footnote: { fontSize: 14, lineHeight: 20, fontWeight: '500', paddingHorizontal: Spacing.one },
  emptyNote: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    paddingHorizontal: Spacing.one,
    marginTop: -Spacing.one,
  },
});
