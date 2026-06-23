import React from 'react';
import { Appearance, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { logError } from '@/lib/errors';

/**
 * Calm, recoverable failure screen — the app's answer to a crash or a failed
 * boot, in place of React Native's raw red screen (or a blank one in production).
 * Self-contained on purpose: it reads no context and pulls colours straight from
 * the palette via the OS scheme, so it renders even when a theme/data provider is
 * what failed.
 */
export function ErrorScreen({
  title = 'Something went wrong',
  body = 'The app hit an unexpected snag. Your reading data is safe on this device.',
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry: () => void;
}) {
  const scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Colors[scheme];

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>{body}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/**
 * Last line of defence against a render crash. Without this, an uncaught throw in
 * any screen drops the user onto the raw error screen — the opposite of "a
 * well-made paperback". Instead we catch it, log it, and show {@link ErrorScreen}
 * with a "Try again" that remounts the tree (most render crashes are transient —
 * a bad bit of state that's gone after a fresh render). Error boundaries must be
 * class components; there's no hook equivalent for `componentDidCatch`.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    logError('ErrorBoundary', error);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error(info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 320,
  },
  button: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.four,
    borderCurve: 'continuous',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
