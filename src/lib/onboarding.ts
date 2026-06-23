/**
 * First-run onboarding (DESIGN.md onboarding flow).
 *
 * Pure selector so the router gate can be unit-tested. The user "needs
 * onboarding" only once settings are loaded *and* the flag is unset — while
 * settings are still null we return false so nothing decides prematurely (the
 * caller holds the splash until `ready`).
 */

export function needsOnboarding(settings: { onboardingComplete: boolean } | null): boolean {
  return settings !== null && !settings.onboardingComplete;
}
