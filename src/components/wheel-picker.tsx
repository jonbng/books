import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import {
  Platform,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

export type WheelOption = { label: string; value: number };

type Props = {
  items: WheelOption[];
  value: number;
  onChange: (value: number) => void;
  /** Height of a single row; the column shows `visibleCount` of them. */
  itemHeight?: number;
  /** Odd number — center row plus equal peeks above/below. */
  visibleCount?: number;
  width?: number;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  /**
   * Soft selection tick as each row crosses center. Off by default to honor the
   * DESIGN-UI.md §5 haptics rationing — opt in per column.
   */
  haptics?: boolean;
};

function tick() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

export function WheelPicker({
  items,
  value,
  onChange,
  itemHeight = 48,
  visibleCount = 3,
  width,
  textStyle,
  accessibilityLabel,
  haptics = false,
}: Props) {
  const ref = useRef<ScrollView>(null);
  const didInit = useRef(false);
  const settledIndex = useRef(indexOf(items, value));
  const scrollY = useSharedValue(0);
  const lastIndex = useSharedValue(indexOf(items, value));
  const pad = ((visibleCount - 1) / 2) * itemHeight;

  // Follow external changes (preset taps); the ref keeps us from re-scrolling to
  // a row the user just landed on themselves.
  useEffect(() => {
    const idx = indexOf(items, value);
    if (idx < 0 || idx === settledIndex.current) return;
    settledIndex.current = idx;
    ref.current?.scrollTo({ y: idx * itemHeight, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      const idx = Math.round(e.contentOffset.y / itemHeight);
      if (idx !== lastIndex.value) {
        lastIndex.value = idx;
        if (haptics) runOnJS(tick)();
      }
    },
  });

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = clamp(Math.round(e.nativeEvent.contentOffset.y / itemHeight), 0, items.length - 1);
    settledIndex.current = idx;
    const next = items[idx];
    if (next && next.value !== value) onChange(next.value);
  };

  // Jump to the starting row once the list is measured (reliable cross-platform).
  const onLayout = (_: LayoutChangeEvent) => {
    if (didInit.current) return;
    didInit.current = true;
    const idx = indexOf(items, value);
    if (idx > 0) ref.current?.scrollTo({ y: idx * itemHeight, animated: false });
  };

  return (
    <View
      style={{ height: itemHeight * visibleCount, width }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable">
      <Animated.ScrollView
        ref={ref}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        disableIntervalMomentum
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: pad }}>
        {items.map((item, index) => (
          <WheelRow
            key={item.value}
            label={item.label}
            index={index}
            itemHeight={itemHeight}
            scrollY={scrollY}
            textStyle={textStyle}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

function WheelRow({
  label,
  index,
  itemHeight,
  scrollY,
  textStyle,
}: {
  label: string;
  index: number;
  itemHeight: number;
  scrollY: SharedValue<number>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const dist = Math.abs(scrollY.value / itemHeight - index);
    return {
      opacity: interpolate(dist, [0, 1, 2], [1, 0.35, 0.12], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(dist, [0, 1, 2], [1, 0.84, 0.7], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View
      style={[{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
      <ThemedText style={textStyle}>{label}</ThemedText>
    </Animated.View>
  );
}

function indexOf(items: WheelOption[], value: number) {
  return items.findIndex((i) => i.value === value);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
