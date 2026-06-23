/**
 * Shared motion language for onboarding (DESIGN-UI.md §5): one calm,
 * soft-settling personality everywhere.
 */
import { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';

/** House easing — the iOS drawer curve. */
export const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Staggered top-to-bottom entrance for the i-th content chunk. 30–50ms between
 * chunks; honors the system reduce-motion setting (movement drops, fade stays).
 */
export const enter = (i = 0) =>
  FadeInDown.delay(i * 45)
    .duration(260)
    .easing(DRAWER)
    .reduceMotion(ReduceMotion.System);
