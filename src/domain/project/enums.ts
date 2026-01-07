// Define the enum types based on the Prisma schema
type ProjectStage = 'concept' | 'schematic' | 'design_development' | 'cd_pre_spec' | 'spec_locked' | 'in_procurement' | 'install';
type ClientType = 'RESIDENTIAL' | 'COMMERCIAL';
type ProjectType = 'UNSPECIFIED' | 'RESIDENTIAL' | 'COMMERCIAL' | 'HOSPITALITY' | 'HEALTHCARE' | 'EDUCATION' | 'OFFICE' | 'RETAIL' | 'INDUSTRIAL' | 'OTHER';
type BudgetBand = 'UNSPECIFIED' | 'LOW' | 'MID' | 'HIGH' | 'LUXURY';

export const STAGE_LABEL: Record<ProjectStage, string> = {
  concept: 'Concept',
  schematic: 'Schematic',
  design_development: 'Design Development',
  cd_pre_spec: 'CD / Pre-Spec',
  spec_locked: 'Spec Locked',
  in_procurement: 'In Procurement',
  install: 'Install',
};

export const CLIENT_LABEL: Record<ClientType, string> = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
};

// Define the actual enum values
const PROJECT_TYPE_VALUES = ['UNSPECIFIED', 'RESIDENTIAL', 'COMMERCIAL', 'HOSPITALITY', 'HEALTHCARE', 'EDUCATION', 'OFFICE', 'RETAIL', 'INDUSTRIAL', 'OTHER'] as const;
const BUDGET_BAND_VALUES = ['UNSPECIFIED', 'LOW', 'MID', 'HIGH', 'LUXURY'] as const;
const STAGE_VALUES = ['concept', 'schematic', 'design_development', 'cd_pre_spec', 'spec_locked', 'in_procurement', 'install'] as const;
const CLIENT_TYPE_VALUES = ['RESIDENTIAL', 'COMMERCIAL'] as const;

// Adjust this to your real enum values if you have more specific project types
export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = Object.fromEntries(
  (Object.values(PROJECT_TYPE_VALUES) as ProjectType[]).map(v => [v, v.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())])
) as Record<ProjectType, string>;

// Budget bands – ensure your enum contains 'unspecified' or whatever first value exists
export const BUDGET_LABEL: Record<BudgetBand, string> = Object.fromEntries(
  (Object.values(BUDGET_BAND_VALUES) as BudgetBand[]).map(v => [v, v.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())])
) as Record<BudgetBand, string>;

// Reverse label→enum maps (case-insensitive)
function reverseMap<T extends string>(m: Record<T, string>) {
  const out = new Map<string, T>();
  (Object.keys(m) as T[]).forEach(k => out.set(m[k].toLowerCase(), k));
  return out;
}

export const STAGE_BY_LABEL = reverseMap(STAGE_LABEL);
export const CLIENT_BY_LABEL = reverseMap(CLIENT_LABEL);
export const PROJECT_TYPE_BY_LABEL = reverseMap(PROJECT_TYPE_LABEL);
export const BUDGET_BY_LABEL = reverseMap(BUDGET_LABEL);

// Safe default pickers: prefer 'unspecified' if present, else first value
export function enumDefault<T extends string>(all: readonly T[], prefer?: T): T {
  if (prefer && all.includes(prefer)) return prefer;
  const unspecified = all.find(v => String(v).toLowerCase() === 'unspecified');
  return (unspecified ?? all[0]) as T;
}

export const DEFAULTS = {
  stage: enumDefault(STAGE_VALUES, 'concept'),
  clientType: enumDefault(CLIENT_TYPE_VALUES),
  projectType: enumDefault(PROJECT_TYPE_VALUES),
  budgetBand: enumDefault(BUDGET_BAND_VALUES, 'UNSPECIFIED'),
};
