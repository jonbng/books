import { Stack } from 'expo-router';

// Welcome is the entry point; the rest are pushed on top so the OS provides the
// base slide transition and a back-stack between steps.
export const unstable_settings = { anchor: 'welcome' };

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
