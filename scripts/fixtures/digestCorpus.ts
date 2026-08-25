/**
 * The corpus-digest fixtures, shared.
 *
 * Extracted from scripts/check-editorial-queue-digest.ts so the churn report
 * (scripts/report-digest-churn.ts) measures the SAME corpus the check exercises
 * rather than a lookalike. A second copy would drift, and a churn number measured
 * on a drifted corpus says nothing about the one the check guards.
 *
 * Pure: no Prisma, no network. `finishFamily` is computed by `materialClassOf` at
 * fixture-build time, which is precisely why a change to MATERIAL_CLASSES can move
 * these numbers — see the churn report.
 */

import type {
  DigestImage,
  DigestProduct,
  DigestProject,
  DigestTag,
  RawCorpusLayer,
} from '../../src/lib/editorial-queue/types';
import { materialClassOf } from '../../src/lib/editorial-queue/signals';

export function makeProduct(id: string, name: string, opts: Partial<DigestProduct> = {}): DigestProduct {
  return {
    productId: id,
    name,
    category: opts.category ?? null,
    brand: opts.brand ?? null,
    colorFinish: opts.colorFinish ?? null,
    finishFamily: materialClassOf(opts.colorFinish ?? null, name),
    vendorId: opts.vendorId ?? null,
    imageSource: opts.imageSource ?? 'VENDOR_REFERENCE',
  };
}

export interface FixtureSpec {
  projects: Array<{
    id: string;
    title: string;
    publishedAt: string;
    budgetBand?: string;
    roomTypes: string[];
    images: Array<{ id: string; roomType: string | null; productIds: string[] }>;
  }>;
  products: DigestProduct[];
  bio?: string;
  productSaves?: Record<string, number>;
}

export function makeRaw(spec: FixtureSpec): RawCorpusLayer {
  const projects: DigestProject[] = [];
  const images: DigestImage[] = [];
  const tags: DigestTag[] = [];
  let tagSeq = 0;

  for (const p of spec.projects) {
    let projectTagCount = 0;
    for (const img of p.images) {
      let derivedSaveCount = 0;
      for (const productId of img.productIds) {
        tags.push({
          tagId: `tag-${++tagSeq}`,
          productId,
          imageId: img.id,
          projectId: p.id,
        });
        projectTagCount++;
        derivedSaveCount += spec.productSaves?.[productId] ?? 0;
      }
      images.push({
        imageId: img.id,
        projectId: p.id,
        roomName: img.roomType,
        roomType: img.roomType,
        tagCount: img.productIds.length,
        derivedSaveCount,
      });
    }
    projects.push({
      projectId: p.id,
      title: p.title,
      category: null,
      budgetBand: p.budgetBand ?? 'UNSPECIFIED',
      stage: 'install',
      city: null,
      regionState: null,
      createdAt: p.publishedAt,
      publishedAt: p.publishedAt,
      postVariant: 'PROJECT_FEATURE',
      roomTypes: p.roomTypes,
      tagCount: projectTagCount,
      saveCount: 0,
    });
  }

  return {
    designer: {
      id: 'designer-1',
      name: 'Test Designer',
      bio: spec.bio ?? null,
      studio: null,
      title: null,
      location: null,
      specialties: [],
    },
    projects,
    images,
    tags,
    products: spec.products,
    interviewAnswers: [],
    priorQueuePieces: [],
    productSaves: spec.productSaves ?? {},
  };
}

// ─── Fixture A: three-story minimum corpus ───────────────────────────────────
// Engineered to contain: brass repetition across 3 kitchens, an exact-product
// repeat, a kitchen room-type concentration, a "warm" bio match, a "vintage"
// bio tension, and an outlier project (bedroom/velvet vs kitchen/brass).

export const brassTap = makeProduct('prod-tap', 'Unlacquered Brass Bridge Faucet', {
  colorFinish: 'Unlacquered Brass', category: 'Plumbing', brand: 'Waterworks',
});
export const brassPull = makeProduct('prod-pull', 'Brushed Brass Cabinet Pull', {
  colorFinish: 'Brushed Brass', category: 'Hardware', brand: 'Waterworks',
});
export const oakStool = makeProduct('prod-stool', 'White Oak Counter Stool', {
  colorFinish: 'Natural Oak', category: 'Furniture',
});
export const velvetBed = makeProduct('prod-bed', 'Velvet Upholstered Bed', {
  colorFinish: 'Emerald Velvet', category: 'Furniture',
});
export const chromeSconce = makeProduct('prod-sconce', 'Polished Chrome Sconce', {
  colorFinish: 'Polished Chrome', category: 'Lighting',
});

export const fixtureA = makeRaw({
  bio: 'A studio drawn to warmth and natural materials, with a vintage sensibility.',
  products: [brassTap, brassPull, oakStool, velvetBed, chromeSconce],
  projects: [
    {
      id: 'proj-1', title: 'Hobbs House', publishedAt: '2026-01-10T00:00:00.000Z',
      budgetBand: 'LUXURY', roomTypes: ['KITCHEN', 'DINING'],
      images: [
        { id: 'img-1a', roomType: 'KITCHEN', productIds: ['prod-tap', 'prod-pull', 'prod-stool'] },
        { id: 'img-1b', roomType: 'KITCHEN', productIds: ['prod-pull'] },
      ],
    },
    {
      id: 'proj-2', title: 'Canal Loft', publishedAt: '2026-03-05T00:00:00.000Z',
      budgetBand: 'LUXURY', roomTypes: ['KITCHEN', 'LIVING'],
      images: [
        { id: 'img-2a', roomType: 'KITCHEN', productIds: ['prod-tap', 'prod-stool'] },
        { id: 'img-2b', roomType: 'LIVING', productIds: [] },
      ],
    },
    {
      id: 'proj-3', title: 'Marlow Pied-à-Terre', publishedAt: '2026-05-20T00:00:00.000Z',
      budgetBand: 'LUXURY', roomTypes: ['BEDROOM'],
      images: [
        { id: 'img-3a', roomType: 'BEDROOM', productIds: ['prod-bed', 'prod-sconce'] },
      ],
    },
  ],
});

console.log('Fixture A — three-story minimum corpus');

// ─── Fixture B: mature corpus (8 stories, 100+ tags, engagement) ─────────────
export const fixtureBProjects: FixtureSpec['projects'] = [];
for (let i = 1; i <= 8; i++) {
  const late = i > 4;
  const productIds = Array.from({ length: 14 }, (_, k) =>
    late ? (k % 2 === 0 ? 'prod-tap' : 'prod-pull') : (k % 2 === 0 ? 'prod-sconce' : 'prod-stool')
  );
  fixtureBProjects.push({
    id: `bproj-${i}`,
    title: `Project ${i}`,
    publishedAt: `2026-0${Math.min(i, 9)}-01T00:00:00.000Z`,
    roomTypes: ['KITCHEN'],
    images: [
      { id: `bimg-${i}a`, roomType: 'KITCHEN', productIds: productIds.slice(0, 7) },
      { id: `bimg-${i}b`, roomType: 'KITCHEN', productIds: productIds.slice(7) },
    ],
  });
}
export const fixtureB = makeRaw({
  products: [brassTap, brassPull, oakStool, chromeSconce],
  projects: fixtureBProjects,
  productSaves: { 'prod-tap': 6, 'prod-pull': 5, 'prod-stool': 0, 'prod-sconce': 0 },
});
