import { z } from 'zod';
import {
  STAGE_BY_LABEL, CLIENT_BY_LABEL, PROJECT_TYPE_BY_LABEL, BUDGET_BY_LABEL, DEFAULTS,
} from '@/domain/project/enums';

// Define the enum types based on the Prisma schema
type ProjectStage = 'concept' | 'schematic' | 'design_development' | 'cd_pre_spec' | 'spec_locked' | 'in_procurement' | 'install';
type ClientType = 'RESIDENTIAL' | 'COMMERCIAL';
type ProjectType = 'UNSPECIFIED' | 'RESIDENTIAL' | 'COMMERCIAL' | 'HOSPITALITY' | 'HEALTHCARE' | 'EDUCATION' | 'OFFICE' | 'RETAIL' | 'INDUSTRIAL' | 'OTHER';
type BudgetBand = 'UNSPECIFIED' | 'LOW' | 'MID' | 'HIGH' | 'LUXURY';

// Canonical API shape we persist
export const CanonicalCreateSchema = z.object({
  title: z.string().min(1),
  stage: z.enum(['concept', 'schematic', 'design_development', 'cd_pre_spec', 'spec_locked', 'in_procurement', 'install']).default(DEFAULTS.stage),
  projectType: z.enum(['UNSPECIFIED', 'RESIDENTIAL', 'COMMERCIAL', 'HOSPITALITY', 'HEALTHCARE', 'EDUCATION', 'OFFICE', 'RETAIL', 'INDUSTRIAL', 'OTHER']).default(DEFAULTS.projectType),
  clientType: z.enum(['RESIDENTIAL', 'COMMERCIAL']).default(DEFAULTS.clientType),
  budgetBand: z.enum(['UNSPECIFIED', 'LOW', 'MID', 'HIGH', 'LUXURY']).default(DEFAULTS.budgetBand),
  city: z.string().optional().nullable(),        // ← optional for now
  regionState: z.string().optional().nullable(), // ← optional for now
  description: z.string().optional().nullable(),
});

// Legacy UI shape (current form)
const LegacySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  client: z.string().optional().nullable(),   // 'Residential' | 'Commercial'
  category: z.string().optional().nullable(), // label for projectType
  images: z.any().optional(),                 // ignored by create API
  // no stage/budget/city/region in legacy
});

// Canonical incoming passthrough (for future form)
const CanonicalIncoming = CanonicalCreateSchema.extend({});

export function normalizeCreatePayload(raw: unknown) {
  // Try canonical first
  const asCanonical = CanonicalIncoming.safeParse(raw);
  if (asCanonical.success) return asCanonical.data;

  // Try legacy and map to canonical
  const asLegacy = LegacySchema.safeParse(raw);
  if (asLegacy.success) {
    const l = asLegacy.data;

    // clientType (label → enum) with safe default
    const clientType =
      (l.client && CLIENT_BY_LABEL.get(l.client.toLowerCase())) ?? DEFAULTS.clientType;

    // projectType (label → enum) with safe default
    const projectType =
      (l.category && PROJECT_TYPE_BY_LABEL.get(l.category.toLowerCase())) ?? DEFAULTS.projectType;

    // budget fallback
    const budgetBand = DEFAULTS.budgetBand;

    // stage default
    const stage = DEFAULTS.stage;

    const candidate = {
      title: l.name,
      description: l.description ?? null,
      clientType,
      projectType,
      budgetBand,
      city: null,
      regionState: null,
      stage,
    };

    // Validate against canonical
    return CanonicalCreateSchema.parse(candidate);
  }

  // Neither matched → throw with canonical schema (clean message)
  return CanonicalCreateSchema.parse(raw);
}
