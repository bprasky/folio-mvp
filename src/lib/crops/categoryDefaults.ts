const CATEGORY_SCALES: Record<string, number> = {
  LIGHTING: 0.55,
  FURNITURE: 0.50,
  HARDWARE: 0.35,
  PLUMBING_FIXTURE: 0.35,
  RUG: 0.45,
  TEXTILE: 0.40,
  ART: 0.45,
  ACCESSORY: 0.38,
  APPLIANCE: 0.45,
  WINDOW_TREATMENT: 0.50,
};

const DEFAULT_SCALE = 0.45;

export function getCategoryDefaultScale(category?: string | null): number {
  if (!category) return DEFAULT_SCALE;
  return CATEGORY_SCALES[category.toUpperCase()] ?? DEFAULT_SCALE;
}
