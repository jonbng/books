import { Ionicons } from '@expo/vector-icons';
import React, { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Elevation, FontFamily, Motion, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DESTRUCTIVE = '#B4442E';

// A toast lingers long enough to read a sentence, a touch longer when it offers
// an action the user might want to tap.
const VISIBLE_MS = 3600;
const VISIBLE_WITH_ACTION_MS = 5200;

export type ToastTone = 'error' | 'info';

export type ToastOptions = {
  tone?: ToastTone;
  /** Optional trailing button, e.g. "Retry". */
  actionLabel?: string;
  onAction?: () => void;
};

type ShowToast = (message: string, options?: ToastOptions) => void;

type ToastApi = {
  /** Show a toast. Defaults to the error tone — this is mostly a failure channel. */
  show: ShowToast;
};

type Current = ToastOptions & { message: string; id: number };

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Lightweight, non-blocking feedback for things that fail (or quietly succeed)
 * without a dialog's ceremony — "Couldn't save your progress", "No connection".
 * A confirm dialog (see ConfirmProvider) asks a question and blocks; a toast just
 * tells you something and slides away on its own.
 *
 * Styled to match the app (warm paper, soft shadow, clay accent) and mounted high
 * in the tree so any screen can summon it via {@link useToast}. One toast shows at
 * a time; a new one replaces whatever's there.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, [clearTimer]);

  const show = useCallback<ShowToast>(
    (message, options) => {
      clearTimer();
      const id = nextId.current++;
      setCurrent({ message, id, ...options });
      const lifespan = options?.actionLabel ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS;
      timer.current = setTimeout(() => setCurrent((c) => (c?.id === id ? null : c)), lifespan);
    },
    [clearTimer]
  );

  useEffect(() => clearTimer, [clearTimer]);

  // Spring up from below as it appears; quick fade-out as it leaves.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.set(
      current
        ? withSpring(1, { ...Motion.successSpring, reduceMotion: ReduceMotion.System })
        : withTiming(0, { duration: Motion.durations.fast, reduceMotion: ReduceMotion.System })
    );
  }, [current, enter]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: reduced ? (current ? 1 : 0) : Math.min(1, enter.get() * 1.5),
    transform: [{ translateY: reduced ? 0 : (1 - enter.get()) * 24 }],
  }));

  const isError = (current?.tone ?? 'error') === 'error';

  return (
    <ToastContext value={{ show }}>
      {children}
      {current ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrap, { paddingBottom: insets.bottom + Spacing.three }, animStyle]}>
          <View
            // Re-key on each toast so the entrance animation replays for back-to-back toasts.
            key={current.id}
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: theme.backgroundElement, boxShadow: Elevation.hero }]}>
            <Ionicons
              name={isError ? 'alert-circle' : 'information-circle'}
              size={20}
              color={isError ? DESTRUCTIVE : theme.accent}
            />
            <Text style={[styles.message, { color: theme.text }]} numberOfLines={3}>
              {current.message}
            </Text>
            {current.actionLabel ? (
              <Pressable
                onPress={() => {
                  current.onAction?.();
                  dismiss();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={current.actionLabel}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <Text style={[styles.actionText, { color: theme.accent }]}>{current.actionLabel}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={dismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                style={({ pressed }) => pressed && styles.pressed}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext>
  );
}

/**
 * Show transient feedback. The returned `show` defaults to the error tone, since
 * that's its main job:
 *
 *   const { show } = useToast();
 *   show("Couldn't save your progress.");          // error
 *   show('Backup copied.', { tone: 'info' });       // info
 */
export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast must be used within a ToastProvider');
  return api;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    maxWidth: 480,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  message: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  action: { paddingHorizontal: Spacing.one },
  actionText: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
