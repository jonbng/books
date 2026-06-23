import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { OnboardingButton } from '@/components/onboarding/onboarding-button';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { enter } from '@/components/onboarding/motion';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';

const OPTIONS = [4, 5, 6, 7];

export default function Rhythm() {
  const theme = useTheme();
  const { settings, setWeeklyTarget } = useAppData();
  const [selected, setSelected] = useState(settings?.weeklyTarget ?? 5);

  const onContinue = async () => {
    await setWeeklyTarget(selected);
    router.push('/(onboarding)/reminder');
  };

  return (
    <OnboardingScaffold
      step={1}
      footer={<OnboardingButton label="Continue" onPress={onContinue} />}>
      <Animated.View entering={enter(0)} style={styles.intro}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.kicker}>
          Your weekly rhythm
        </ThemedText>
        <ThemedText style={styles.title}>How many days a week?</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Life happens — pick a rhythm you can actually keep. Hit it and the week counts. You can
          change this anytime.
        </ThemedText>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.row}>
        {OPTIONS.map((n) => {
          const active = n === selected;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(n)}
              style={[
                styles.chip,
                { backgroundColor: active ? theme.accent : theme.backgroundElement },
              ]}>
              <ThemedText
                style={[styles.chipNum, { color: active ? theme.background : theme.text }]}>
                {n}
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: active ? theme.background : theme.textSecondary }}>
                days
              </ThemedText>
            </Pressable>
          );
        })}
      </Animated.View>
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
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    flex: 1,
    paddingVertical: Spacing.four,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    gap: 2,
  },
  chipNum: {
    fontFamily: FontFamily.semibold,
    fontSize: 30,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
