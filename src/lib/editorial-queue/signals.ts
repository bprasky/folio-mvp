// Editorial Queue — deterministic signal layer (docs/17_EDITORIAL_QUEUE.md).
// Pure functions over RawCorpusLayer: no Prisma, no API calls, no Date.now().
// Same corpus in, same signals (and signal IDs) out.

import type {
  ComputedSignal,
  DigestProject,
  RawCorpusLayer,
  SignalType,
} from './types';

// ─── Shared helpers ──────────────────────────────────────────────────────────

// Material classes, checked in order against colorFinish then product name.
// 'unlacquered brass' and 'brushed brass' both normalize to 'brass' so repetition
// sees deliberate loyalty across spec variants.
//
// NAMED FOR WHAT IT HOLDS. This was FINISH_FAMILIES, which collided with an
// unrelated 31-entry constant of the same name in src/lib/naming/descriptor.ts.
// That one is a DESCRIPTOR vocabulary — 'matte black', 'brushed steel',
// 'stainless', 'lacquer' — assembled for swap-in text when a product may not be
// named in prose. This one is a CLASS vocabulary: marble, travertine, oak, brass,
// the nouns a published headline actually uses. Two constants with one name over
// two vocabularies is an import waiting to go to the wrong list, and the headline
// frame library reads this one.
export const MATERIAL_CLASSES = [
  'brass', 'bronze', 'copper', 'nickel', 'chrome', 'pewter', 'zinc', 'iron',
  'steel', 'gold', 'silver',
  'oak', 'walnut', 'maple', 'ash', 'teak', 'mahogany', 'pine', 'birch',
  'marble', 'travertine', 'limestone', 'granite', 'quartz', 'soapstone',
  'terracotta', 'concrete', 'terrazzo', 'plaster',
  'linen', 'leather', 'velvet', 'boucle', 'wool', 'rattan', 'cane', 'jute',
  'lacquer', 'ceramic', 'glass',
] as const;

export function materialClassOf(colorFinish: string | null, productName: string): string | null {
  const haystack = `${colorFinish ?? ''} ${productName}`.toLowerCase();
  for (const cls of MATERIAL_CLASSES) {
    if (haystack.includes(cls)) return cls;
  }
  return null;
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ─── Repetition ──────────────────────────────────────────────────────────────
// Same product, vendor/brand, or finish family in 2+ of the designer's
// projects. One repeated spec across independent projects is a deliberate
// choice; deliberate choices are stories.

export function computeRepetitionSignals(raw: RawCorpusLayer): ComputedSignal[] {
  const signals: ComputedSignal[] = [];
  const productById = new Map(raw.products.map((p) => [p.productId, p]));
  const projectCount = raw.projects.length;

  type Group = { projectIds: Set<string>; tagIds: string[]; productIds: Set<string> };
  const groupInto = (map: Map<string, Group>, key: string, tag: { tagId: string; projectId: string; productId: string }) => {
    const g = map.get(key) ?? { projectIds: new Set(), tagIds: [], productIds: new Set() };
    g.projectIds.add(tag.projectId);
    g.tagIds.push(tag.tagId);
    g.productIds.add(tag.productId);
    map.set(key, g);
  };

  const byProduct = new Map<string, Group>();
  const byBrand = new Map<string, Group>();
  const byFamily = new Map<string, Group>();

  for (const tag of raw.tags) {
    const product = productById.get(tag.productId);
    if (!product) continue;
    groupInto(byProduct, tag.productId, tag);
    if (product.brand) groupInto(byBrand, slug(product.brand), tag);
    if (product.finishFamily) groupInto(byFamily, product.finishFamily, tag);
  }

  for (const [productId, g] of Array.from(byProduct.entries())) {
    if (g.projectIds.size < 2) continue;
    const product = productById.get(productId)!;
    signals.push({
      id: `rep:product:${productId}`,
      type: 'repetition',
      headline: `"${product.name}" is specced in ${g.projectIds.size} of ${projectCount} projects`,
      detail: `The exact same product appears across independent projects — a deliberate, repeated choice rather than a one-off spec.`,
      strength: Math.min(1, g.projectIds.size / projectCount + 0.2),
      evidence: {
        productIds: [productId],
        productTagIds: g.tagIds,
        projectIds: Array.from(g.projectIds),
      },
    });
  }

  for (const [brandKey, g] of Array.from(byBrand.entries())) {
    if (g.projectIds.size < 2 || g.productIds.size < 2) continue;
    const brandName = productById.get(Array.from(g.productIds)[0])?.brand ?? brandKey;
    signals.push({
      id: `rep:brand:${brandKey}`,
      type: 'repetition',
      headline: `${g.productIds.size} different ${brandName} products across ${g.projectIds.size} projects`,
      detail: `Vendor loyalty beyond a single product: the designer returns to ${brandName} with different specs.`,
      strength: Math.min(1, g.projectIds.size / projectCount),
      evidence: {
        productIds: Array.from(g.productIds),
        productTagIds: g.tagIds,
        projectIds: Array.from(g.projectIds),
        facts: { brand: brandName },
      },
    });
  }

  for (const [family, g] of Array.from(byFamily.entries())) {
    if (g.projectIds.size < 2) continue;
    signals.push({
      id: `rep:finish:${family}`,
      type: 'repetition',
      headline: `${family} appears in ${g.projectIds.size} of ${projectCount} projects (${g.tagIds.length} tagged specs)`,
      detail: `A material loyalty: the ${family} family recurs across independent projects and different products.`,
      strength: Math.min(1, g.projectIds.size / projectCount),
      evidence: {
        productIds: Array.from(g.productIds),
        productTagIds: g.tagIds,
        projectIds: Array.from(g.projectIds),
        facts: { finishFamily: family },
      },
    });
  }

  return signals;
}

// ─── Distribution ────────────────────────────────────────────────────────────
// Room-type spread, budget-band spread, category concentration. Concentration
// reveals what the designer cares about versus what the project required.

const ROOM_CONCENTRATION_MIN_SHARE = 0.4;
const CATEGORY_CONCENTRATION_MIN_SHARE = 0.3;

export function computeDistributionSignals(raw: RawCorpusLayer): ComputedSignal[] {
  const signals: ComputedSignal[] = [];
  const productById = new Map(raw.products.map((p) => [p.productId, p]));

  // Room-type concentration over tagged images.
  const imagesByRoomType = new Map<string, string[]>();
  for (const img of raw.images) {
    if (!img.roomType || img.tagCount === 0) continue;
    const list = imagesByRoomType.get(img.roomType) ?? [];
    list.push(img.imageId);
    imagesByRoomType.set(img.roomType, list);
  }
  const taggedImageTotal = Array.from(imagesByRoomType.values()).reduce((n, l) => n + l.length, 0);
  if (imagesByRoomType.size >= 2) {
    const [topType, topImages] = Array.from(imagesByRoomType.entries()).sort(
      (a, b) => b[1].length - a[1].length
    )[0];
    const topShare = share(topImages.length, taggedImageTotal);
    if (topShare >= ROOM_CONCENTRATION_MIN_SHARE) {
      signals.push({
        id: `dist:room:${slug(topType)}`,
        type: 'distribution',
        headline: `${pct(topShare)} of tagged imagery is ${topType.toLowerCase().replace(/_/g, ' ')} work`,
        detail: `Across ${imagesByRoomType.size} room types, the corpus concentrates on one — where the designer's attention actually goes.`,
        strength: topShare,
        evidence: {
          imageIds: topImages,
          facts: { roomType: topType, shareOfTaggedImages: Math.round(topShare * 100) },
        },
      });
    }
  }

  // Budget-band spread across projects.
  const bandCounts = new Map<string, string[]>();
  for (const p of raw.projects) {
    if (p.budgetBand === 'UNSPECIFIED') continue;
    const list = bandCounts.get(p.budgetBand) ?? [];
    list.push(p.projectId);
    bandCounts.set(p.budgetBand, list);
  }
  if (bandCounts.size === 1 && raw.projects.length >= 3) {
    const [band, projectIds] = Array.from(bandCounts.entries())[0];
    if (projectIds.length === raw.projects.length) {
      signals.push({
        id: `dist:budget:${slug(band)}`,
        type: 'distribution',
        headline: `Every published project sits in the ${band} budget band`,
        detail: `A consistent client tier — the practice has a defined lane rather than a scattered book.`,
        strength: 0.6,
        evidence: { projectIds, facts: { budgetBand: band } },
      });
    }
  }

  // Product-category concentration across all tags.
  const tagsByCategory = new Map<string, { tagIds: string[]; productIds: Set<string> }>();
  for (const tag of raw.tags) {
    const category = productById.get(tag.productId)?.category;
    if (!category) continue;
    const g = tagsByCategory.get(category) ?? { tagIds: [], productIds: new Set() };
    g.tagIds.push(tag.tagId);
    g.productIds.add(tag.productId);
    tagsByCategory.set(category, g);
  }
  const categorizedTagTotal = Array.from(tagsByCategory.values()).reduce(
    (n, g) => n + g.tagIds.length,
    0
  );
  if (tagsByCategory.size >= 3) {
    const [topCategory, topGroup] = Array.from(tagsByCategory.entries()).sort(
      (a, b) => b[1].tagIds.length - a[1].tagIds.length
    )[0];
    const topShare = share(topGroup.tagIds.length, categorizedTagTotal);
    if (topShare >= CATEGORY_CONCENTRATION_MIN_SHARE) {
      signals.push({
        id: `dist:category:${slug(topCategory)}`,
        type: 'distribution',
        headline: `${pct(topShare)} of all tagged specs are ${topCategory}`,
        detail: `Across ${tagsByCategory.size} categories the tagging concentrates in one — the category the designer specs with conviction.`,
        strength: topShare,
        evidence: {
          productIds: Array.from(topGroup.productIds),
          productTagIds: topGroup.tagIds,
          facts: { category: topCategory, shareOfTags: Math.round(topShare * 100) },
        },
      });
    }
  }

  return signals;
}

// ─── Claim versus evidence ───────────────────────────────────────────────────
// Bio positioning terms checked against actual finish/product data. The gap or
// the match writes the question; either could only be asked of this designer.

// Term lexicon: bio keyword -> the corpus evidence that would substantiate it.
// V1 is deliberately modest; extend as real cohort bios surface new terms.
const POSITIONING_TERMS: Array<{
  term: string;
  bioPatterns: RegExp;
  families: string[];
  categories: string[];
}> = [
  {
    term: 'warm',
    bioPatterns: /\bwarm(th|er)?\b/i,
    families: ['brass', 'bronze', 'copper', 'walnut', 'oak', 'terracotta', 'leather'],
    categories: [],
  },
  {
    term: 'natural materials',
    bioPatterns: /\bnatural\b|\borganic\b/i,
    families: ['oak', 'walnut', 'teak', 'linen', 'rattan', 'cane', 'jute', 'wool', 'travertine', 'limestone'],
    categories: [],
  },
  {
    term: 'minimal',
    bioPatterns: /\bminimal(ist|ism)?\b|\brestrain(ed|t)\b/i,
    families: ['plaster', 'concrete', 'oak', 'linen'],
    categories: [],
  },
  {
    term: 'traditional',
    bioPatterns: /\btraditional\b|\bclassic\b|\bheritage\b/i,
    families: ['mahogany', 'brass', 'marble', 'velvet'],
    categories: ['Antiques', 'Millwork'],
  },
  {
    term: 'vintage',
    bioPatterns: /\bvintage\b|\bantique\b/i,
    families: [],
    categories: ['Antiques', 'Vintage'],
  },
  {
    term: 'stone',
    bioPatterns: /\bstone\b|\bmarble\b/i,
    families: ['marble', 'travertine', 'limestone', 'granite', 'soapstone', 'quartz', 'terrazzo'],
    categories: [],
  },
  {
    term: 'texture',
    bioPatterns: /\btexture(d|s)?\b|\btactile\b/i,
    families: ['boucle', 'linen', 'rattan', 'plaster', 'jute', 'wool', 'cane'],
    categories: [],
  },
  {
    term: 'color',
    bioPatterns: /\bcolor(ful)?\b|\bbold\b|\bsaturated\b/i,
    families: ['lacquer', 'velvet', 'ceramic'],
    categories: [],
  },
];

const CLAIM_MATCH_MIN_ROWS = 3;
const CLAIM_MATCH_MIN_PROJECTS = 2;

export function computeClaimEvidenceSignals(raw: RawCorpusLayer): ComputedSignal[] {
  const signals: ComputedSignal[] = [];
  const bioText = [raw.designer.bio ?? '', raw.designer.specialties.join(' ')].join(' ');
  if (!bioText.trim()) return signals;

  const productById = new Map(raw.products.map((p) => [p.productId, p]));

  for (const entry of POSITIONING_TERMS) {
    if (!entry.bioPatterns.test(bioText)) continue;

    const tagIds: string[] = [];
    const productIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const tag of raw.tags) {
      const product = productById.get(tag.productId);
      if (!product) continue;
      const familyHit = product.finishFamily !== null && entry.families.includes(product.finishFamily);
      const categoryHit = product.category !== null && entry.categories.includes(product.category);
      if (familyHit || categoryHit) {
        tagIds.push(tag.tagId);
        productIds.add(tag.productId);
        projectIds.add(tag.projectId);
      }
    }

    const isMatch = tagIds.length >= CLAIM_MATCH_MIN_ROWS && projectIds.size >= CLAIM_MATCH_MIN_PROJECTS;
    const isTension = tagIds.length <= 1;
    if (!isMatch && !isTension) continue; // ambiguous middle: no signal

    signals.push({
      id: `cve:${isMatch ? 'match' : 'tension'}:${slug(entry.term)}`,
      type: 'claim_evidence',
      headline: isMatch
        ? `The bio's "${entry.term}" positioning is substantiated: ${tagIds.length} specs across ${projectIds.size} projects back it`
        : `The bio claims "${entry.term}" but the tagged work shows ${tagIds.length === 0 ? 'no' : 'only one'} supporting spec`,
      detail: isMatch
        ? `Stated positioning and the actual spec record agree — the claim is demonstrable with rows.`
        : `A gap between stated positioning and the tagged evidence — either the tagging is incomplete or the positioning is aspirational. Both are questions only this designer can answer.`,
      strength: isMatch ? Math.min(1, tagIds.length / 10 + 0.3) : 0.7,
      evidence: {
        productIds: Array.from(productIds),
        productTagIds: tagIds,
        projectIds: Array.from(projectIds),
        facts: { bioTerm: entry.term, verdict: isMatch ? 'match' : 'tension' },
      },
    });
  }

  return signals;
}

// ─── Outlier ─────────────────────────────────────────────────────────────────
// The project or spec that breaks the pattern of the others. At three projects
// an outlier is loud.

const PROJECT_OUTLIER_MIN_DISTANCE = 0.6;

export function computeOutlierSignals(raw: RawCorpusLayer): ComputedSignal[] {
  const signals: ComputedSignal[] = [];
  if (raw.projects.length < 3) return signals;

  const productById = new Map(raw.products.map((p) => [p.productId, p]));

  // Per-project trait sets: room types + finish families.
  const traitsByProject = new Map<string, Set<string>>();
  for (const p of raw.projects) {
    traitsByProject.set(p.projectId, new Set(p.roomTypes.map((t) => `room:${t}`)));
  }
  for (const tag of raw.tags) {
    const family = productById.get(tag.productId)?.finishFamily;
    if (family) traitsByProject.get(tag.projectId)?.add(`finish:${family}`);
  }

  const jaccardDistance = (a: Set<string>, b: Set<string>): number => {
    if (a.size === 0 && b.size === 0) return 0;
    const intersection = Array.from(a).filter((item) => b.has(item)).length;
    return 1 - intersection / (a.size + b.size - intersection);
  };

  let outlier: { project: DigestProject; distance: number } | null = null;
  for (const p of raw.projects) {
    const mine = traitsByProject.get(p.projectId)!;
    const others = raw.projects.filter((o) => o.projectId !== p.projectId);
    const avgDistance =
      others.reduce((sum, o) => sum + jaccardDistance(mine, traitsByProject.get(o.projectId)!), 0) /
      others.length;
    if (avgDistance >= PROJECT_OUTLIER_MIN_DISTANCE && (!outlier || avgDistance > outlier.distance)) {
      outlier = { project: p, distance: avgDistance };
    }
  }

  if (outlier) {
    signals.push({
      id: `outlier:project:${outlier.project.projectId}`,
      type: 'outlier',
      headline: `"${outlier.project.title}" breaks the pattern of the rest of the corpus`,
      detail: `Its room mix and material palette diverge from every other published project (trait overlap distance ${outlier.distance.toFixed(2)}). The departure is the story: what pulled the designer off their own defaults?`,
      strength: outlier.distance,
      evidence: {
        projectIds: [outlier.project.projectId],
        facts: { distance: Number(outlier.distance.toFixed(2)) },
      },
    });
  }

  // Finish family that appears in exactly one project while the designer
  // repeats other families — a one-time material departure.
  const familyProjects = new Map<string, { projectIds: Set<string>; tagIds: string[] }>();
  for (const tag of raw.tags) {
    const family = productById.get(tag.productId)?.finishFamily;
    if (!family) continue;
    const g = familyProjects.get(family) ?? { projectIds: new Set(), tagIds: [] };
    g.projectIds.add(tag.projectId);
    g.tagIds.push(tag.tagId);
    familyProjects.set(family, g);
  }
  const repeatedFamilies = Array.from(familyProjects.values()).filter(
    (g) => g.projectIds.size >= 2
  ).length;
  if (repeatedFamilies >= 2) {
    for (const [family, g] of Array.from(familyProjects.entries())) {
      if (g.projectIds.size !== 1 || g.tagIds.length < 2) continue;
      const projectId = Array.from(g.projectIds)[0];
      const project = raw.projects.find((p) => p.projectId === projectId);
      signals.push({
        id: `outlier:finish:${family}`,
        type: 'outlier',
        headline: `${family} shows up only in "${project?.title ?? projectId}" and nowhere else`,
        detail: `The designer repeats other material families across projects, but ${family} was a single-project decision — an experiment, a client ask, or a site-specific answer.`,
        strength: 0.5,
        evidence: {
          projectIds: [projectId],
          productTagIds: g.tagIds,
          facts: { finishFamily: family },
        },
      });
    }
  }

  return signals;
}

// ─── Save-delta (maturity-gated) ─────────────────────────────────────────────
// Image whose derived save activity materially exceeds corpus baseline,
// computed by joining product-level Save records through the image's tags.
// Philosophically saves-as-edges: "people saved products that live in this
// image" — directional interest grounded in the lineage graph.

const SAVE_DELTA_MIN_COUNT = 3;
const SAVE_DELTA_MULTIPLE = 2;

export function computeSaveDeltaSignals(raw: RawCorpusLayer): ComputedSignal[] {
  const signals: ComputedSignal[] = [];
  const withActivity = raw.images.filter((img) => img.tagCount > 0);
  if (withActivity.length < 2) return signals;

  const mean =
    withActivity.reduce((sum, img) => sum + img.derivedSaveCount, 0) / withActivity.length;

  for (const img of withActivity) {
    if (img.derivedSaveCount < SAVE_DELTA_MIN_COUNT) continue;
    if (img.derivedSaveCount < mean * SAVE_DELTA_MULTIPLE) continue;
    const project = raw.projects.find((p) => p.projectId === img.projectId);
    const multiple = mean > 0 ? img.derivedSaveCount / mean : img.derivedSaveCount;
    signals.push({
      id: `sd:image:${img.imageId}`,
      type: 'save_delta',
      headline: `One ${img.roomType ? img.roomType.toLowerCase().replace(/_/g, ' ') : 'room'} image in "${project?.title ?? img.projectId}" is earning ${multiple.toFixed(1)}x the corpus baseline in product saves`,
      detail: `Audience interest measured through the lineage graph: viewers save the products that live in this image far more than elsewhere in the corpus. Anatomy-of-a-room material.`,
      strength: Math.min(1, multiple / 4),
      evidence: {
        imageIds: [img.imageId],
        projectIds: [img.projectId],
        facts: { derivedSaveCount: img.derivedSaveCount, corpusMean: Number(mean.toFixed(1)) },
      },
    });
  }

  return signals;
}

// ─── Evolution (maturity-gated) ──────────────────────────────────────────────
// Directional change in material/finish family share across the project
// timeline, comparing the earlier half of published work to the later half.

const EVOLUTION_MIN_DELTA = 0.15;

export function computeEvolutionSignals(raw: RawCorpusLayer): ComputedSignal[] {
  const signals: ComputedSignal[] = [];
  const productById = new Map(raw.products.map((p) => [p.productId, p]));

  const timeline = raw.projects
    .filter((p) => p.publishedAt !== null)
    .sort((a, b) => (a.publishedAt! < b.publishedAt! ? -1 : 1));
  if (timeline.length < 4) return signals;

  const midpoint = Math.floor(timeline.length / 2);
  const earlyIds = new Set(timeline.slice(0, midpoint).map((p) => p.projectId));
  const lateIds = new Set(timeline.slice(midpoint).map((p) => p.projectId));

  const familyShares = (projectIds: Set<string>): Map<string, number> => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const tag of raw.tags) {
      if (!projectIds.has(tag.projectId)) continue;
      const family = productById.get(tag.productId)?.finishFamily;
      if (!family) continue;
      counts.set(family, (counts.get(family) ?? 0) + 1);
      total++;
    }
    const shares = new Map<string, number>();
    for (const [family, count] of Array.from(counts.entries())) {
      shares.set(family, share(count, total));
    }
    return shares;
  };

  const early = familyShares(earlyIds);
  const late = familyShares(lateIds);
  const allFamilies = new Set(
    Array.from(early.keys()).concat(Array.from(late.keys()))
  );

  for (const family of Array.from(allFamilies)) {
    const delta = (late.get(family) ?? 0) - (early.get(family) ?? 0);
    if (Math.abs(delta) < EVOLUTION_MIN_DELTA) continue;
    const direction = delta > 0 ? 'rising' : 'receding';
    signals.push({
      id: `evo:finish:${family}:${direction}`,
      type: 'evolution',
      headline: `${family} is ${direction} across the timeline: ${pct(early.get(family) ?? 0)} of early specs to ${pct(late.get(family) ?? 0)} of recent ones`,
      detail: `A directional material shift across the published sequence — the palette is moving, and the move is measurable.`,
      strength: Math.min(1, Math.abs(delta) * 3),
      evidence: {
        projectIds: Array.from(earlyIds).concat(Array.from(lateIds)),
        facts: {
          finishFamily: family,
          earlyShare: Math.round((early.get(family) ?? 0) * 100),
          lateShare: Math.round((late.get(family) ?? 0) * 100),
          direction,
        },
      },
    });
  }

  return signals;
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export const SIGNAL_COMPUTATIONS: Record<SignalType, (raw: RawCorpusLayer) => ComputedSignal[]> = {
  repetition: computeRepetitionSignals,
  distribution: computeDistributionSignals,
  claim_evidence: computeClaimEvidenceSignals,
  outlier: computeOutlierSignals,
  save_delta: computeSaveDeltaSignals,
  evolution: computeEvolutionSignals,
};
