import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { OnboardingButton } from '@/components/onboarding/onboarding-button';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { enter } from '@/components/onboarding/motion';
import { ThemedText } from '@/components/themed-text';
import { WheelPicker, type WheelOption } from '@/components/wheel-picker';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { isReminderSupported } from '@/services/notifications';

const PRESETS = [
  { label: 'Morning', hour: 8 },
  { label: 'Midday', hour: 13 },
  { label: 'Evening', hour: 20 },
  { label: 'Night', hour: 22 },
];

const ITEM_HEIGHT = 48;
const VISIBLE = 3;

const HOUR_ITEMS: WheelOption[] = Array.from({ length: 12 }, (_, i) => ({
  label: String(i + 1),
  value: i + 1,
}));
const MINUTE_ITEMS: WheelOption[] = Array.from({ length: 12 }, (_, i) => ({
  label: String(i * 5).padStart(2, '0'),
  value: i * 5,
}));
const AMPM_ITEMS: WheelOption[] = [
  { label: 'AM', value: 0 },
  { label: 'PM', value: 1 },
];

/** 24h hour → 12h face value (1–12). */
function to12(hour: number) {
  return hour % 12 === 0 ? 12 : hour % 12;
}
/** 12h face value + AM/PM flag → 24h hour. */
function to24(h12: number, pm: number) {
  return (pm ? (h12 % 12) + 12 : h12 % 12);
}

export default function Reminder() {
  const theme = useTheme();
  const { settings, setReminder } = useAppData();
  const [hour, setHour] = useState(settings?.reminderHour ?? 20);
  const [minute, setMinute] = useState(
    Math.round((settings?.reminderMinute ?? 0) / 5) * 5 % 60,
  );
  const supported = isReminderSupported();

  const h12 = to12(hour);
  const pm = hour >= 12 ? 1 : 0;

  const onSet = async () => {
    await setReminder({ enabled: true, hour, minute });
    router.push('/(onboarding)/book');
  };

  const onSkip = async () => {
    await setReminder({ enabled: false, hour, minute });
    router.push('/(onboarding)/book');
  };

  return (
    <OnboardingScaffold
      step={2}
      footer={
        <>
          <OnboardingButton label="Set reminder" onPress={onSet} />
          <OnboardingButton label="Maybe later" variant="ghost" onPress={onSkip} />
        </>
      }>
      <Animated.View entering={enter(0)} style={styles.intro}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.kicker}>
          A gentle nudge
        </ThemedText>
        <ThemedText style={styles.title}>When should we remind you?</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          One nudge a day to keep your streak alive. No nagging — pick a time that fits your routine.
        </ThemedText>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.wheelWrap}>
        <View
          pointerEvents="none"
          style={[styles.band, { backgroundColor: theme.backgroundSelected }]}
        />
        <WheelPicker
          items={HOUR_ITEMS}
          value={h12}
          onChange={(v) => setHour(to24(v, pm))}
          itemHeight={ITEM_HEIGHT}
          visibleCount={VISIBLE}
          width={62}
          haptics
          accessibilityLabel="Hour"
          textStyle={[styles.wheelDigit, { color: theme.text }]}
        />
        <ThemedText style={[styles.colon, { color: theme.text }]}>:</ThemedText>
        <WheelPicker
          items={MINUTE_ITEMS}
          value={minute}
          onChange={setMinute}
          itemHeight={ITEM_HEIGHT}
          visibleCount={VISIBLE}
          width={62}
          haptics
          accessibilityLabel="Minute"
          textStyle={[styles.wheelDigit, { color: theme.text }]}
        />
        <WheelPicker
          items={AMPM_ITEMS}
          value={pm}
          onChange={(v) => setHour(to24(h12, v))}
          itemHeight={ITEM_HEIGHT}
          visibleCount={VISIBLE}
          width={56}
          haptics
          accessibilityLabel="AM or PM"
          textStyle={[styles.wheelAmpm, { color: theme.text }]}
        />
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.presets}>
        {PRESETS.map((preset) => {
          const active = preset.hour === hour && minute === 0;
          return (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              onPress={() => {
                setHour(preset.hour);
                setMinute(0);
              }}
              style={[
                styles.preset,
                { backgroundColor: active ? theme.accent : theme.backgroundElement },
              ]}>
              <ThemedText
                type="small"
                style={{ color: active ? theme.background : theme.textSecondary }}>
                {preset.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </Animated.View>

      {!supported && (
        <Animated.View entering={enter(3)}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Reminders need a development build — they won&apos;t fire in Expo Go, but we&apos;ll save
            your time for later.
          </ThemedText>
        </Animated.View>
      )}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.two,
  },
  kicker: {
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
  },
  wheelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.one,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    top: ITEM_HEIGHT, // center row of a 3-row column
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  wheelDigit: {
    fontFamily: FontFamily.semibold,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  colon: {
    fontFamily: FontFamily.semibold,
    fontSize: 30,
    fontWeight: '600',
    marginHorizontal: Spacing.half,
  },
  wheelAmpm: {
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    fontWeight: '600',
  },
  presets: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  preset: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  note: {
    textAlign: 'center',
  },
});
