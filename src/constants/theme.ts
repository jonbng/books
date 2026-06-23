/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Warm & cozy direction (DESIGN-UI.md): "a well-made paperback". The content
// plane is warm matte paper (oat); a single terracotta/clay accent carries the
// streak, filled dots, progress, and the primary "I read today" action. Ink is a
// warm near-black — never pure black.
export const Colors = {
  light: {
    text: '#2B2722', // warm ink
    background: '#F7F3EA', // bright warm cream
    backgroundElement: '#F0EBDF', // raised surface, near-paper (low contrast)
    backgroundSelected: '#E7E0D0', // pressed / selected
    textSecondary: '#8A8175', // warm gray (not brown)
    accent: '#C0694A', // terracotta / clay
  },
  dark: {
    text: '#F2EADD',
    background: '#1A1611',
    backgroundElement: '#241F18',
    backgroundSelected: '#322A1F',
    textSecondary: '#B0A492',
    accent: '#D98A63', // lifted clay for dark
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// --- Design language tokens (DESIGN-UI.md) ----------------------------------

/**
 * Warm-tinted elevation ramp. Shadows on warm paper must be brown, never gray —
 * a gray shadow on oat is the #1 tell of a cheap cozy app. Used via the RN
 * `boxShadow` string style prop.
 */
export const Elevation = {
  rest: '0px 1px 2px rgba(60, 40, 25, 0.10)',
  raised: '0px 4px 12px rgba(60, 40, 25, 0.16)',
  hero: '0px 8px 24px rgba(60, 40, 25, 0.20)',
} as const;

/**
 * Fraunces (serif-forward, literary) registration names. These strings are the
 * keys passed to `useFonts` in the root layout — referencing the key as
 * `fontFamily` is what selects the loaded face. Small UI labels stay on the
 * system sans (leave `fontFamily` undefined).
 */
export const FontFamily = {
  regular: 'Fraunces_400Regular',
  medium: 'Fraunces_500Medium',
  semibold: 'Fraunces_600SemiBold',
  bold: 'Fraunces_700Bold',
} as const;

/**
 * Type scale. Display / streak / headline use Fraunces; label / caption use the
 * system sans. `streak` carries tabular-nums so the counter never reflows.
 */
export const Type = {
  display: { fontFamily: FontFamily.semibold, fontSize: 34, lineHeight: 40 },
  streak: {
    fontFamily: FontFamily.semibold,
    fontSize: 64,
    lineHeight: 68,
    fontVariant: ['tabular-nums'] as const,
  },
  headline: { fontFamily: FontFamily.semibold, fontSize: 24, lineHeight: 30 },
  title: { fontFamily: FontFamily.medium, fontSize: 19, lineHeight: 25 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
  },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
} as const;

/**
 * Motion language: calm, slightly slow, soft-settling. The bezier is stored as a
 * tuple so this module stays free of a reanimated import — consumers build
 * `Easing.bezier(...Motion.easingBezier)`. Springs are plain configs for
 * `withSpring`.
 */
export const Motion = {
  /** iOS drawer curve — the house easing for any timing-based motion. */
  easingBezier: [0.32, 0.72, 0, 1] as const,
  /** Tight, no-bounce press feedback (scale to 0.96). */
  pressSpring: { damping: 26, stiffness: 360, mass: 0.7 },
  /** Gentle overshoot-and-settle for the day-mark + dot fill. */
  successSpring: { damping: 14, stiffness: 170, mass: 0.9 },
  durations: { fast: 140, base: 220 },
} as const;

/**
 * Whisper vertical gradient for the paper plane (lighter top → deeper bottom),
 * implying light from above. Applied via `experimental_backgroundImage`; falls
 * back to flat `background` where unsupported (Android). Polish, not load-bearing.
 */
export const PaperGradient = {
  light: 'linear-gradient(180deg, #FAF6EF 0%, #F4EFE3 100%)',
  dark: 'linear-gradient(180deg, #1D1913 0%, #161209 100%)',
} as const;
