/**
 * App-wide color scheme with a user override.
 *
 * The OS scheme (`useRNColorScheme`) is the default, but the user can force light
 * or dark in Settings (persisted as `themePreference`). `ColorSchemeProvider`
 * resolves the preference against the OS scheme once, high in the tree, so every
 * `useColorScheme()` consumer — and the navigation theme — reads one value.
 */

import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import type { ColorSchemePreference } from '@/constants/theme';

const ColorSchemeContext = createContext<'light' | 'dark'>('light');

export function ColorSchemeProvider({
  preference,
  children,
}: {
  preference: ColorSchemePreference;
  children: ReactNode;
}) {
  // On web the OS scheme isn't reliable until after hydration, so assume light for
  // the first client render (matching the static HTML) and re-resolve once mounted.
  // Native knows the scheme synchronously, so it starts hydrated.
  const [hydrated, setHydrated] = useState(process.env.EXPO_OS !== 'web');
  // Static-render hydration handshake (Expo web): flip once on mount so the first
  // client render matches the server HTML, then re-resolve the real OS scheme.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);

  const system = useRNColorScheme();
  const resolved =
    preference === 'system' ? (hydrated && system === 'dark' ? 'dark' : 'light') : preference;

  return <ColorSchemeContext value={resolved}>{children}</ColorSchemeContext>;
}

/** The resolved scheme ('light' | 'dark'), honoring the user's override. */
export function useColorScheme(): 'light' | 'dark' {
  return use(ColorSchemeContext);
}
