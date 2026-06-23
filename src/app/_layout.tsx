import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CelebrationProvider } from '@/components/celebration/celebration-provider';
import { ConfirmProvider } from '@/components/confirm/confirm-provider';
import { ErrorBoundary, ErrorScreen } from '@/components/error-boundary';
import { ToastProvider } from '@/components/toast/toast-provider';
import { Colors } from '@/constants/theme';
import { ColorSchemeProvider, useColorScheme } from '@/hooks/use-color-scheme';
import { AppDataProvider, useAppData } from '@/hooks/use-app-data';

// Warm navigation themes — without these, React Navigation's defaults bleed a
// blue primary and a white/gray screen background (visible during transitions)
// into the otherwise all-warm app. Card/background = paper so pushes/fades show
// oat, never white; primary/notification = clay.
const NavLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.accent,
    background: Colors.light.background,
    card: Colors.light.background,
    text: Colors.light.text,
    border: 'transparent',
    notification: Colors.light.accent,
  },
};
const NavDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.accent,
    background: Colors.dark.background,
    card: Colors.dark.background,
    text: Colors.dark.text,
    border: 'transparent',
    notification: Colors.dark.accent,
  },
};

// Hold the native splash until we know whether the user needs onboarding, so the
// gate decides before anything paints (no flash of the main app on first launch).
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready, loadError, retryLoad, needsOnboarding } = useAppData();
  // Fraunces is the app's serif voice (streak, headlines). Gate the splash on it
  // too, but render anyway on `fontError` so a missing glyph file never bricks
  // launch — the system serif shows instead.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    // Drop the splash once we're ready OR the load failed — otherwise a boot
    // error would strand the user on the splash forever.
    if ((ready || loadError) && fontsReady) void SplashScreen.hideAsync();
  }, [ready, loadError, fontsReady]);

  // The database wouldn't open or migrate — show a calm retry instead of a hang.
  if (loadError) {
    return (
      <ErrorScreen
        title="Couldn’t open your library"
        body="Something went wrong loading your data. It’s still saved on this device."
        onRetry={retryLoad}
      />
    );
  }

  if (!ready || !fontsReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!needsOnboarding}>
        <Stack.Screen name="(app)" />
        {/* Transparent modal so the shelf stays visible behind the detail page
            — the drag-to-dismiss peels the page away to reveal it. We drive the
            open/close ourselves (cover hero + drag), so disable the native one. */}
        <Stack.Screen
          name="book/[id]"
          options={{ presentation: 'transparentModal', animation: 'none' }}
        />
        <Stack.Screen name="settings" />
        {/* Live reading-session timer — a focused, dismissible activity, not a
            place in the stack. */}
        <Stack.Screen name="session" options={{ presentation: 'modal' }} />
        {/* Add-a-book flow — a dismissible modal over the Shelf, with the
            camera scanner pushed full-screen on top of it. */}
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="scan"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
    </Stack>
  );
}

// Bridges the resolved scheme (which honors the user's theme override) into the
// React Navigation theme. Must live inside ColorSchemeProvider to read it.
function NavThemeBridge() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? NavDark : NavLight}>
      {/* Dark status-bar icons on the cream background, light icons in dark mode. */}
      <StatusBar style="auto" />
      <ToastProvider>
        <CelebrationProvider>
          <ConfirmProvider>
            <ErrorBoundary>
              <RootNavigator />
            </ErrorBoundary>
          </ConfirmProvider>
        </CelebrationProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// Reads the persisted theme preference (defaulting to "follow the OS" until
// settings load) and resolves it for the whole app.
function ThemedRoot() {
  const { settings } = useAppData();
  return (
    <ColorSchemeProvider preference={settings?.themePreference ?? 'system'}>
      <NavThemeBridge />
    </ColorSchemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppDataProvider>
      <ThemedRoot />
    </AppDataProvider>
  );
}
