import { z } from 'zod';
import {
  STAGE_BY_LABEL, CLIENT_BY_LABEL, PROJECT_TYPE_BY_LABEL, BUDGET_BY_LABEL, DEFAULTS,
} from '@/domain/project/enums';

// Define the enum types based on the Prisma schema
type ProjectStage = 'concept' | 'schematic' | 'design_development' | 'cd_pre_spec' | 'spec_locked' | 'in_procurement' | 'install';
type ClientType = 'RESIDENTIAL' | 'COMMERCIAL';
type ProjectType = 'UNSPECIFIED' | 'RESIDENTIAL' | 'COMMERCIAL' | 'HOSPITALITY' | 'HEALTHCARE' | 'EDUCATION' | 'OFFICE' | 'RETAIL' | 'INDUSTRIAL' | 'OTHER';
type BudgetBand = 'UNSPECIFIED' | 'LOW' | 'MID' | 'HIGH' | 'LUXURY';

// Credit schema for project collaborators
const CreditSchema = z.object({
  role: z.string(),
  userId: z.string().optional(),
  name: z.string(),
  email: z.string().optional(),
  profileImage: z.string().optional(),
  studio: z.string().optional(),
  isInvite: z.boolean().optional(),
  url: z.string().optional(),
});

// Project status: new_project (in progress) or completed_project (ready to showcase)
type ProjectStatus = 'new_project' | 'completed_project';

// Canonical API shape we persist
export const CanonicalCreateSchema = z.object({
  title: z.string().min(1),
  projectStatus: z.enum(['new_project', 'completed_project']),
  stage: z.enum(['concept', 'schematic', 'design_development', 'cd_pre_spec', 'spec_locked', 'in_procurement', 'install']).default(DEFAULTS.stage),
  projectType: z.enum(['UNSPECIFIED', 'RESIDENTIAL', 'COMMERCIAL', 'HOSPITALITY', 'HEALTHCARE', 'EDUCATION', 'OFFICE', 'RETAIL', 'INDUSTRIAL', 'OTHER']).default(DEFAULTS.projectType),
  clientType: z.enum(['RESIDENTIAL', 'COMMERCIAL']).default(DEFAULTS.clientType),
  budgetBand: z.enum(['UNSPECIFIED', 'LOW', 'MID', 'HIGH', 'LUXURY']).default(DEFAULTS.budgetBand),
  city: z.string().optional().nullable(),        // ← optional for now
  regionState: z.string().optional().nullable(), // ← optional for now
  description: z.string().optional().nullable(),
  credits: z.array(CreditSchema).optional(),     // ← credits for ProjectPost
});

// Legacy UI shape (current form) - now includes projectStatus
const LegacySchema = z.object({
  name: z.string().min(1),
  projectStatus: z.enum(['new_project', 'completed_project']),
  description: z.string().optional().nullable(),
  client: z.string().optional().nullable(),   // 'Residential' | 'Commercial'
  category: z.string().optional().nullable(), // label for projectType
  images: z.any().optional(),                 // ignored by create API
  credits: z.array(CreditSchema).optional(),  // ← credits for ProjectPost
  detailsCore: z.any().optional(),            // advanced details from form
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
    const details = l.detailsCore ?? {};

    // clientType (label → enum) with safe default
    const clientType =
      (l.client && CLIENT_BY_LABEL.get(l.client.toLowerCase())) ??
      (details.clientType && CLIENT_BY_LABEL.get(details.clientType.toLowerCase())) ??
      DEFAULTS.clientType;

    // projectType (label → enum) with safe default
    const projectType =
      (l.category && PROJECT_TYPE_BY_LABEL.get(l.category.toLowerCase())) ??
      (details.projectType && PROJECT_TYPE_BY_LABEL.get(details.projectType.toLowerCase())) ??
      DEFAULTS.projectType;

    // budget - always default to UNSPECIFIED (budget band removed from form)
    const budgetBand = DEFAULTS.budgetBand;

    // stage from detailsCore or default
    const stage =
      (details.stage && STAGE_BY_LABEL.get(details.stage.toLowerCase())) ??
      DEFAULTS.stage;

    // Location from detailsCore
    const city = details.location?.city ?? null;
    const regionState = details.location?.region ?? null;

    const candidate: any = {
      title: l.name,
      projectStatus: l.projectStatus,
      description: l.description ?? null,
      clientType,
      projectType,
      budgetBand,
      city,
      regionState,
      stage,
    };

    // Pass through credits if provided
    if (l.credits) {
      candidate.credits = l.credits;
    }

    // Validate against canonical
    return CanonicalCreateSchema.parse(candidate);
  }

  // Neither matched → throw with canonical schema (clean message)
  return CanonicalCreateSchema.parse(raw);
}
