import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { PaperBackground } from '@/components/paper';
import { ActiveSessionStrip } from '@/components/today/active-session-strip';
import { StartSessionSheet } from '@/components/session/start-session-sheet';
import { useStartSession } from '@/components/session/use-start-session';
import { CheckInHero } from '@/components/today/check-in-hero';
import { CurrentlyReadingStrip } from '@/components/today/currently-reading-strip';
import { MiniHeatmap } from '@/components/today/mini-heatmap';
import { StreakDisplay } from '@/components/today/streak-display';
import { TodayHeader } from '@/components/today/today-header';
import { WeekDots } from '@/components/today/week-dots';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useStatusBarInset } from '@/hooks/use-status-bar-inset';
import { useTheme } from '@/hooks/use-theme';

export default function TodayScreen() {
  const store = useAppData();
  const theme = useTheme();
  const topInset = useStatusBarInset();
  const { begin, sheetVisible, closeSheet } = useStartSession();

  if (!store.ready || !store.streak || !store.settings) {
    return (
      <PaperBackground style={styles.loading}>
        <Text style={{ color: theme.textSecondary }}>Loading…</Text>
      </PaperBackground>
    );
  }

  const { streak, today, activeSession } = store;
  const weeklyTarget = store.settings.weeklyTarget;
  const { weekStreak, currentWeek, readToday } = streak;
  const activeBook = activeSession
    ? store.books.find((b) => b.id === activeSession.bookId) ?? null
    : null;

  return (
    <PaperBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: Spacing.four + topInset }]}>
        <TodayHeader today={today} onSettings={() => router.push('/settings')} />

        {activeSession ? (
          <ActiveSessionStrip session={activeSession} book={activeBook} />
        ) : (
          <Pressable
            onPress={begin}
            accessibilityRole="button"
            accessibilityLabel="Start a reading session"
            style={({ pressed }) => [
              styles.startButton,
              { borderColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.startText, { color: theme.accent }]}>Start a reading session</Text>
          </Pressable>
        )}

        <CheckInHero
          readToday={readToday}
          onToggle={() => store.toggleToday()}
          readingBooks={store.booksByShelf.reading}
          todayDetail={store.todayDetail}
          onLogDetail={(detail) => store.setTodayDetail(detail)}
        />

        <WeekDots
          monday={currentWeek.monday}
          readDays={currentWeek.readDays}
          today={today}
          daysRead={currentWeek.daysRead}
          weeklyTarget={weeklyTarget}
          goalHit={currentWeek.status === 'complete'}
        />

        <StreakDisplay weekStreak={weekStreak} />

        <CurrentlyReadingStrip books={store.booksByShelf.reading} />

        {store.stats ? <MiniHeatmap heatmap={store.stats.heatmap} today={today} /> : null}
      </ScrollView>
      <StartSessionSheet visible={sheetVisible} onClose={closeSheet} />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  startButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
  },
  startText: { fontFamily: FontFamily.semibold, fontSize: 16 },
  pressed: { opacity: 0.7 },
});
