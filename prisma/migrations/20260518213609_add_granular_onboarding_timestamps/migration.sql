-- AlterTable: add granular onboarding flow timestamps (additive, idempotent)
-- See 17_ONBOARDING_FLOW. These four columns track resume state for the
-- Diagnostic → Firm Context → Bio Capture → Profile Preview sequence.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "onboardingDiagnosticAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingFirmContextAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingBioCaptureAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingProfilePreviewAt" TIMESTAMP(3);
