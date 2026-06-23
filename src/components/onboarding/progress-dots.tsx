import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { DRAWER } from './motion';

/**
 * Goal-gradient progress indicator. The active dot is a clay pill; width changes
 * tween via a layout animation (DESIGN-UI §5 — calm, soft-settling).
 */
export function ProgressDots({ total, index }: { total: number; index: number }) {
  const theme = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === index;
        return (
          <Animated.View
            key={i}
            layout={LinearTransition.duration(220).easing(DRAWER)}
            style={[
              styles.dot,
              active
                ? { width: 18, backgroundColor: theme.accent }
                : { width: 6, backgroundColor: theme.backgroundSelected },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
