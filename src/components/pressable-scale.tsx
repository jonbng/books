import { forwardRef } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /** Scale at the bottom of the press. Always >= 0.95 (DESIGN-UI §5 / scale-on-press). */
  activeScale?: number;
  /** Optional dim layered on the scale — kept for icons/text where a little fade reads well. */
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pressable that springs to `activeScale` (default 0.96) on press and settles
 * back — the house tactile-feedback primitive. Driven on the UI thread with
 * `Motion.pressSpring` so it's interruptible (a quick tap reverses mid-spring),
 * and it honors reduced-motion by dropping the scale while keeping any opacity dim.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { activeScale = 0.96, pressedOpacity = 0, style, onPressIn, onPressOut, ...rest },
  ref
) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  // Reduced motion drops the positional movement; fall back to a gentle dim so
  // the press still registers for anyone who's turned animation down.
  const effScale = reduced ? 1 : activeScale;
  const effOpacity = reduced && pressedOpacity === 0 ? 0.25 : pressedOpacity;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - effScale) * pressed.get() }],
    opacity: 1 - effOpacity * pressed.get(),
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    pressed.set(withSpring(1, Motion.pressSpring));
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    pressed.set(withSpring(0, Motion.pressSpring));
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      ref={ref}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      {...rest}
    />
  );
});
