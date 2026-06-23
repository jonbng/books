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
import { useColorScheme } from 'react-native';

import { CelebrationProvider } from '@/components/celebration/celebration-provider';
import { Colors } from '@/constants/theme';
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
  const { ready, needsOnboarding } = useAppData();
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
    if (ready && fontsReady) void SplashScreen.hideAsync();
  }, [ready, fontsReady]);

  if (!ready || !fontsReady) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!needsOnboarding}>
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="book/[id]"
          options={{ animation: 'fade', animationDuration: 280 }}
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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? NavDark : NavLight}>
      {/* Dark status-bar icons on the cream background, light icons in dark mode. */}
      <StatusBar style="auto" />
      <AppDataProvider>
        <CelebrationProvider>
          <RootNavigator />
        </CelebrationProvider>
      </AppDataProvider>
    </ThemeProvider>
  );
}
