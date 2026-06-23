import AppTabs from '@/components/app-tabs';

/**
 * The main app: native tabs (Today / Shelf / Stats). Reached once first-run
 * onboarding is complete — the root layout's `Stack.Protected` guard gates it.
 */
export default function AppLayout() {
  return <AppTabs />;
}
