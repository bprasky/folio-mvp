import type { TierLimits } from './tiers';

// Founder-approved first designer round. No timer or automatic conversion to paid.
// Change only after explicit founder authorization to introduce paid memberships.
// This waives subscription requirements, never identity or project permissions.
export const DESIGNER_EARLY_ACCESS_ENABLED = true;

export const DESIGNER_EARLY_ACCESS_LIMITS: TierLimits = {
  projects: null,
  moodboards: null,
  designerSeats: -1,
  clientsPerProject: null,
  aiEditorialGenerationsPerMonth: null,
  storageGb: -1,
};
