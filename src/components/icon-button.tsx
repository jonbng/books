import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/hooks/use-theme';

export type IconButtonProps = {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A round, 44×44 tappable icon — the standard nav affordance (back, settings,
 * add). Uses Ionicons so it renders identically on iOS and Android.
 */
export function IconButton({
  name,
  onPress,
  size = 22,
  color,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={10}
      pressedOpacity={0.3}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.button, style]}>
      <Ionicons name={name} size={size} color={color ?? theme.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
});
