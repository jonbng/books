import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { OnboardingButton } from '@/components/onboarding/onboarding-button';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { enter } from '@/components/onboarding/motion';
import { ThemedText } from '@/components/themed-text';
import { FontFamily } from '@/constants/theme';

export default function Welcome() {
  return (
    <OnboardingScaffold
      step={0}
      footer={
        <OnboardingButton label="Let's begin" onPress={() => router.push('/(onboarding)/rhythm')} />
      }>
      <Animated.View entering={enter(0)}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.kicker}>
          A reading habit
        </ThemedText>
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <ThemedText style={styles.headline}>Did you read today?</ThemedText>
      </Animated.View>
      <Animated.View entering={enter(2)}>
        <ThemedText type="default" themeColor="textSecondary">
          Answer yes a little more often. We&apos;ll keep a gentle, forgiving streak — no guilt, no
          pressure. Just you and the next few pages.
        </ThemedText>
      </Animated.View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  kicker: {
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: FontFamily.semibold,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '600',
  },
});
