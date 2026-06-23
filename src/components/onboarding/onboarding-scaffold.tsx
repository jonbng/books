import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaperBackground } from '@/components/paper';
import { Spacing } from '@/constants/theme';
import { ProgressDots } from './progress-dots';

/**
 * Shared frame for every onboarding step: progress dots up top, centered content,
 * a footer for CTAs. Paper plane — quiet warm background, no chrome.
 */
export function OnboardingScaffold({
  step,
  totalSteps = 4,
  children,
  footer,
}: {
  step: number;
  totalSteps?: number;
  children: ReactNode;
  footer: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <PaperBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
        ]}>
        <ProgressDots total={totalSteps} index={step} />
        <View style={styles.content}>{children}</View>
        <View style={styles.footer}>{footer}</View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  footer: {
    gap: Spacing.two,
  },
});
