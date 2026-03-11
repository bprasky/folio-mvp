const CATEGORY_SCALES: Record<string, number> = {
  LIGHTING: 0.30,
  FURNITURE: 0.25,
  HARDWARE: 0.15,
  PLUMBING_FIXTURE: 0.15,
  RUG: 0.20,
  TEXTILE: 0.20,
  ART: 0.22,
  ACCESSORY: 0.18,
  APPLIANCE: 0.22,
  WINDOW_TREATMENT: 0.25,
};

const DEFAULT_SCALE = 0.22;

export function getCategoryDefaultScale(category?: string | null): number {
  if (!category) return DEFAULT_SCALE;
  return CATEGORY_SCALES[category.toUpperCase()] ?? DEFAULT_SCALE;
}
