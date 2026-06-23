import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScreenHeaderProps = {
  title?: string;
  /** Show a back chevron. Defaults to true; calls `onBack` or `router.back()`. */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
};

/**
 * Lightweight in-content header for pushed paper screens (book detail, settings).
 * We render our own instead of a native stack header so the whole screen stays on
 * the paper plane with Fraunces titles and full design control.
 */
export function ScreenHeader({ title, back = true, onBack, right }: ScreenHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: insets.top + Spacing.two }]}>
      {back ? (
        <IconButton
          name="chevron-back"
          accessibilityLabel="Back"
          color={theme.accent}
          size={26}
          onPress={() => (onBack ? onBack() : router.back())}
          style={styles.back}
        />
      ) : (
        <View style={styles.back} />
      )}

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const SIDE = 44;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  back: {
    width: SIDE,
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.semibold,
    fontSize: Type.headline.fontSize,
    lineHeight: Type.headline.lineHeight,
  },
  right: {
    minWidth: SIDE,
    alignItems: 'flex-end',
  },
  pressed: { opacity: 0.5 },
});
