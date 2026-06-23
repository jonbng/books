import { View, type ViewProps, type ViewStyle } from 'react-native';

import { Elevation, PaperGradient, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The warm matte paper content plane (DESIGN-UI.md §2). Flat oat background is
 * the reliable floor everywhere; a whisper top→bottom gradient is layered on
 * where supported (`experimental_backgroundImage`, a no-op on Android — it just
 * degrades to flat oat). Grain texture is deferred to a later polish pass.
 */
export function PaperBackground({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const gradient = PaperGradient[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={[
        { flex: 1, backgroundColor: theme.background },
        // Experimental, New-Arch only; silently ignored elsewhere.
        { experimental_backgroundImage: gradient } as ViewStyle,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

type Elevated = keyof typeof Elevation;

export type PaperProps = ViewProps & {
  /** Warm-shadow elevation. Defaults to `rest`. */
  elevation?: Elevated;
  /** Corner radius. Defaults to a generous, continuous-curve radius. */
  radius?: number;
};

/**
 * A reusable matte raised surface — the card primitive for the hero, week-dots,
 * the currently-reading strip, and later slices. Floats on a warm (never gray)
 * contact shadow with a continuous corner curve; no hard borders.
 */
export function Paper({
  elevation = 'rest',
  radius = Spacing.four,
  style,
  children,
  ...rest
}: PaperProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.backgroundElement,
          borderRadius: radius,
          borderCurve: 'continuous',
          boxShadow: Elevation[elevation],
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}
