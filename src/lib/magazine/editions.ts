// src/lib/magazine/editions.ts
//
// Magazine Editions Configuration
// 
// Conceptual shift: Feed → Magazine
// - Instead of a generic feed, we now have curated editorial "editions"
// - Each edition represents a different lens on the design content
// - Editions are configured here (no DB schema changes in this pass)
// - Future: Editorial scoring will be powered by AI/telemetry, currently heuristic

export type MagazineEditionType = "personal" | "global" | "local" | "style";

export type MagazineEditionSlug =
  | "for-you"
  | "global"
  | "local"
  | "modern"
  | "tropical"
  | "midcentury";

export interface MagazineEditionConfig {
  slug: MagazineEditionSlug;
  label: string;
  type: MagazineEditionType;
  description?: string;
  // optional: icon name or Hero subtitle, etc.
}

export const MAGAZINE_EDITIONS: MagazineEditionConfig[] = [
  {
    slug: "for-you",
    label: "For You",
    type: "personal",
    description: "Curated editorial for your taste and activity.",
  },
  {
    slug: "global",
    label: "Global",
    type: "global",
    description: "The most compelling projects and products worldwide.",
  },
  {
    slug: "local",
    label: "Local",
    type: "local",
    description: "Designs and vendors near you.",
  },
  {
    slug: "modern",
    label: "Folio Modern",
    type: "style",
    description: "Modern spaces, clean lines, and restrained palettes.",
  },
  {
    slug: "tropical",
    label: "Folio Tropical",
    type: "style",
    description: "Modern tropical, indoor-outdoor flow, and natural textures.",
  },
  {
    slug: "midcentury",
    label: "Folio Midcentury",
    type: "style",
    description: "Midcentury forms, warm woods, and iconic silhouettes.",
  },
];

export function getEditionConfig(slug: string): MagazineEditionConfig {
  const match = MAGAZINE_EDITIONS.find((e) => e.slug === slug);
  return match ?? MAGAZINE_EDITIONS[0]; // default to For You
}




