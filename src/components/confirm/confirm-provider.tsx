import React, { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FontFamily, Motion, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DESTRUCTIVE = '#B4442E';

export type ConfirmOptions = {
  title: string;
  message?: string;
  /** Primary button label (defaults to "Confirm"). */
  confirmLabel?: string;
  /** Cancel button label (defaults to "Cancel"). */
  cancelLabel?: string;
  /** Tint the primary button as a destructive action. */
  destructive?: boolean;
};

type ConfirmApi = { confirm: (options: ConfirmOptions) => Promise<boolean> };

type Pending = { options: ConfirmOptions; resolve: (ok: boolean) => void };

const ConfirmContext = createContext<ConfirmApi | null>(null);

/**
 * Replaces the OS `Alert.alert` confirm dialog with an in-style one (DESIGN-UI:
 * warm paper, Fraunces title, clay accent). Exposes an imperative `confirm()`
 * that resolves to the user's choice, so call sites read like the native API:
 *
 *   if (await confirm({ title: 'Remove?', destructive: true })) …
 *
 * Lives high in the tree (root layout) so any screen can summon it.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [pending, setPending] = useState<Pending | null>(null);

  // Hold the live resolver in a ref so dismissing (back button / backdrop) can
  // resolve `false` without going stale, and so a request is never left hanging.
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setPending({ options, resolve });
      }),
    []
  );

  const close = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setPending(null);
  }, []);

  // Spring the card up as the backdrop fades in — matches the app's soft-settle.
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.set(
      pending
        ? withSpring(1, { ...Motion.successSpring, reduceMotion: ReduceMotion.System })
        : withTiming(0, { duration: Motion.durations.fast, reduceMotion: ReduceMotion.System })
    );
  }, [pending, enter]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : Math.min(1, enter.get() * 1.4),
    transform: [{ scale: reduced ? 1 : 0.92 + 0.08 * enter.get() }],
  }));

  const options = pending?.options;

  return (
    <ConfirmContext value={{ confirm }}>
      {children}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => close(false)}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        />
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: theme.background }, cardStyle]}>
            {options ? (
              <>
                <Text style={[styles.title, { color: theme.text }]}>{options.title}</Text>
                {options.message ? (
                  <Text style={[styles.message, { color: theme.textSecondary }]}>
                    {options.message}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => close(true)}
                    accessibilityRole="button"
                    accessibilityLabel={options.confirmLabel ?? 'Confirm'}
                    style={({ pressed }) => [
                      styles.primary,
                      { backgroundColor: options.destructive ? DESTRUCTIVE : theme.accent },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.primaryText}>{options.confirmLabel ?? 'Confirm'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => close(false)}
                    accessibilityRole="button"
                    accessibilityLabel={options.cancelLabel ?? 'Cancel'}
                    style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
                    <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                      {options.cancelLabel ?? 'Cancel'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Animated.View>
        </View>
      </Modal>
    </ConfirmContext>
  );
}

export function useConfirm(): ConfirmApi['confirm'] {
  const api = use(ConfirmContext);
  if (!api) throw new Error('useConfirm must be used within a ConfirmProvider');
  return api.confirm;
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(30, 22, 14, 0.35)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: Spacing.four,
    borderRadius: 28,
    borderCurve: 'continuous',
    gap: Spacing.two,
    boxShadow: '0px 8px 24px rgba(60, 40, 25, 0.20)',
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    lineHeight: 26,
  },
  message: { fontSize: 15, lineHeight: 21 },
  actions: { gap: Spacing.two, marginTop: Spacing.three },
  primary: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.three },
  cancelText: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
