// Shared between components/onboarding/ProductTour (reads/writes the flag as
// React state) and pages/Help's "Restart Product Tour" control (clears it as
// a one-off side effect before navigating into the app) so both agree on the
// same localStorage key without duplicating the format.
export function onboardingStorageKey(userId) {
  return `uask.onboarding.completed.${userId}`
}

export function resetOnboarding(userId) {
  try {
    window.localStorage.removeItem(onboardingStorageKey(userId))
  } catch {
    // Storage unavailable — nothing to reset.
  }
}
