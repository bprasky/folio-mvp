// Resume logic for the 17_ONBOARDING_FLOW guided sequence.
// Single source of truth shared by middleware, the state API, and the resume page.

export type OnboardingStep =
  | 'diagnostic'
  | 'firm'
  | 'bio'
  | 'profile-preview'
  | 'done';

export interface OnboardingTimestamps {
  onboardingDiagnosticAt?: Date | string | null;
  onboardingFirmContextAt?: Date | string | null;
  onboardingBioCaptureAt?: Date | string | null;
  onboardingProfilePreviewAt?: Date | string | null;
}

const PROFESSIONAL_ROLES = new Set([
  'DESIGNER',
  'ARCHITECT',
  'BUILDER',
]);

export function isProfessionalRole(role: string | null | undefined): boolean {
  return !!role && PROFESSIONAL_ROLES.has(role);
}

export function nextOnboardingStep(
  role: string | null | undefined,
  ts: OnboardingTimestamps
): OnboardingStep {
  if (!ts.onboardingDiagnosticAt) return 'diagnostic';
  // Non-professional roles (INDIVIDUAL, GUEST, ADMIN, VENDOR, etc.) finish at the diagnostic.
  if (!isProfessionalRole(role)) return 'done';
  if (!ts.onboardingFirmContextAt) return 'firm';
  if (!ts.onboardingBioCaptureAt) return 'bio';
  if (!ts.onboardingProfilePreviewAt) return 'profile-preview';
  return 'done';
}

export function resumePathForStep(step: OnboardingStep): string {
  switch (step) {
    case 'diagnostic':
      return '/onboarding/diagnostic';
    case 'firm':
      return '/onboarding/firm';
    case 'bio':
      return '/onboarding/bio';
    case 'profile-preview':
      return '/onboarding/profile-preview';
    case 'done':
      return '/';
  }
}

export function isOnboardingComplete(
  role: string | null | undefined,
  ts: OnboardingTimestamps
): boolean {
  return nextOnboardingStep(role, ts) === 'done';
}
