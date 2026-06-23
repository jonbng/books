import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Paper, PaperBackground } from '@/components/paper';
import { ScreenHeader } from '@/components/screen-header';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';

const TARGET_OPTIONS = [4, 5, 6, 7];

export default function SettingsScreen() {
  const data = useAppData();
  const theme = useTheme();
  const s = data.settings;

  if (!s) {
    return (
      <PaperBackground style={styles.loading}>
        <ScreenHeader title="Settings" />
      </PaperBackground>
    );
  }

  const time = `${String(s.reminderHour).padStart(2, '0')}:${String(s.reminderMinute).padStart(2, '0')}`;

  function setReminderTime(hourDelta: number, minuteCycle: boolean) {
    if (!s) return;
    let hour = s.reminderHour;
    let minute = s.reminderMinute;
    if (minuteCycle) {
      minute = (minute + 15) % 60;
    } else {
      hour = (hour + hourDelta + 24) % 24;
    }
    void data.setReminder({ enabled: s.reminderEnabled, hour, minute });
  }

  function changeYearly(delta: number) {
    if (!s) return;
    const base = s.yearlyGoal ?? 12;
    void data.setYearlyGoal(Math.max(1, base + delta));
  }

  return (
    <PaperBackground>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Weekly goal */}
        <Paper style={styles.card}>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>WEEKLY GOAL</Text>
          <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
            How many days a week you aim to read. Miss it and a banked freeze covers the week
            automatically.
          </Text>
          <View style={styles.chips}>
            {TARGET_OPTIONS.map((t) => {
              const active = t === s.weeklyTarget;
              return (
                <Chip
                  key={t}
                  label={String(t)}
                  active={active}
                  onPress={() => data.setWeeklyTarget(t)}
                />
              );
            })}
            <Text style={[styles.chipSuffix, { color: theme.textSecondary }]}>days / week</Text>
          </View>
        </Paper>

        {/* Daily reminder */}
        <Paper style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>READING REMINDER</Text>
            <Switch
              accessibilityLabel="Daily reminder"
              value={s.reminderEnabled}
              onValueChange={(enabled) =>
                data.setReminder({ enabled, hour: s.reminderHour, minute: s.reminderMinute })
              }
              trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.backgroundSelected}
            />
          </View>
          {s.reminderEnabled ? (
            <>
              <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
                A gentle daily nudge at this time that quietly eases off when you’re away — and
                stops nagging once you’ve clearly taken a break.
              </Text>
              <View style={styles.timeRow}>
                <Stepper label="Hour −" onPress={() => setReminderTime(-1, false)} />
                <Stepper label="Hour +" onPress={() => setReminderTime(1, false)} />
                <Text style={[styles.time, { color: theme.text }]}>{time}</Text>
                <Stepper label="Min +15" onPress={() => setReminderTime(0, true)} />
              </View>
            </>
          ) : (
            <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
              A gentle nudge to read, at a time you choose.
            </Text>
          )}
        </Paper>

        {/* Yearly reading goal */}
        <Paper style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>YEARLY GOAL</Text>
            <Switch
              accessibilityLabel="Yearly reading goal"
              value={s.yearlyGoal != null}
              onValueChange={(on) => data.setYearlyGoal(on ? 12 : null)}
              trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.backgroundSelected}
            />
          </View>
          {s.yearlyGoal != null ? (
            <View style={styles.timeRow}>
              <Stepper label="−6" onPress={() => changeYearly(-6)} />
              <Stepper label="−1" onPress={() => changeYearly(-1)} />
              <Text style={[styles.time, { color: theme.text }]}>
                {s.yearlyGoal} <Text style={{ color: theme.textSecondary }}>books</Text>
              </Text>
              <Stepper label="+1" onPress={() => changeYearly(1)} />
              <Stepper label="+6" onPress={() => changeYearly(6)} />
            </View>
          ) : (
            <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
              An encouraging target for the year — never a guilt meter.
            </Text>
          )}
        </Paper>

        <Text style={[styles.footnote, { color: theme.textSecondary }]}>
          Freezes are automatic — read consistently to bank them, and a missed week is covered
          without you lifting a finger. Everything lives on this device.
        </Text>
      </ScrollView>
    </PaperBackground>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} days per week`}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? theme.accent : theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.stepper,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.stepperText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {},
  content: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },
  card: { padding: Spacing.four, gap: Spacing.three },
  cardLabel: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  cardHint: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: {
    width: 46,
    height: 46,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: FontFamily.semibold, fontSize: 17 },
  chipSuffix: { marginLeft: 'auto', fontSize: 14, fontWeight: '500' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  time: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  stepper: {
    paddingHorizontal: Spacing.two,
    height: 40,
    minWidth: 44,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontSize: 13, fontWeight: '700' },
  footnote: { fontSize: 14, lineHeight: 20, fontWeight: '500', paddingHorizontal: Spacing.one },
  pressed: { opacity: 0.7 },
});
