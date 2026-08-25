// Fixture-driven check for the Editorial Queue corpus digest builder.
// Pure-layer only (no Prisma, no network) — run with:
//   npm run check:digest   (tsx scripts/check-editorial-queue-digest.ts)
//
// Verifies the guarantees angle extraction depends on:
//   1. Maturity ladder gates signal types at the right corpus depths.
//   2. Expected signals fire on a corpus engineered to contain them.
//   3. Every evidence row ID resolves to a real raw-layer row (the
//      validation-reject rule's foundation).
//   4. Signal IDs are unique and the whole digest is deterministic.

import { buildCorpusDigest } from '../src/lib/editorial-queue/buildCorpusDigest';
import type {
  DigestImage,
  DigestProduct,
  DigestProject,
  DigestTag,
  RawCorpusLayer,
} from '../src/lib/editorial-queue/types';
import { materialClassOf } from '../src/lib/editorial-queue/signals';

let failures = 0;
function check(name: string, condition: boolean, context?: unknown) {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, context !== undefined ? JSON.stringify(context, null, 2) : '');
  }
}

// ─── Fixture builders ────────────────────────────────────────────────────────

function makeProduct(id: string, name: string, opts: Partial<DigestProduct> = {}): DigestProduct {
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

interface FixtureSpec {
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

function makeRaw(spec: FixtureSpec): RawCorpusLayer {
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

const brassTap = makeProduct('prod-tap', 'Unlacquered Brass Bridge Faucet', {
  colorFinish: 'Unlacquered Brass', category: 'Plumbing', brand: 'Waterworks',
});
const brassPull = makeProduct('prod-pull', 'Brushed Brass Cabinet Pull', {
  colorFinish: 'Brushed Brass', category: 'Hardware', brand: 'Waterworks',
});
const oakStool = makeProduct('prod-stool', 'White Oak Counter Stool', {
  colorFinish: 'Natural Oak', category: 'Furniture',
});
const velvetBed = makeProduct('prod-bed', 'Velvet Upholstered Bed', {
  colorFinish: 'Emerald Velvet', category: 'Furniture',
});
const chromeSconce = makeProduct('prod-sconce', 'Polished Chrome Sconce', {
  colorFinish: 'Polished Chrome', category: 'Lighting',
});

const fixtureA = makeRaw({
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
const digestA = buildCorpusDigest(fixtureA);

check('maturity counts 3 published stories', digestA.maturity.publishedStoryCount === 3);
check(
  'base signal types eligible at 3 stories',
  ['repetition', 'distribution', 'claim_evidence', 'outlier'].every((t) =>
    digestA.maturity.eligibleSignalTypes.includes(t as never)
  ),
  digestA.maturity
);
check(
  'save_delta and evolution gated off at 3 stories',
  !digestA.maturity.eligibleSignalTypes.includes('save_delta') &&
    !digestA.maturity.eligibleSignalTypes.includes('evolution'),
  digestA.maturity
);

const ids = digestA.signals.map((s) => s.id);
check('signal IDs unique', new Set(ids).size === ids.length, ids);
check('brass repetition fires', ids.includes('rep:finish:brass'), ids);
check('exact-product repetition fires (tap in 2 projects)', ids.includes('rep:product:prod-tap'), ids);
check('brand repetition fires (Waterworks)', ids.includes('rep:brand:waterworks'), ids);
check('kitchen concentration fires', ids.includes('dist:room:kitchen'), ids);
check('"warm" bio claim matches evidence', ids.includes('cve:match:warm'), ids);
check('"vintage" bio claim flagged as tension', ids.includes('cve:tension:vintage'), ids);
check('bedroom project detected as outlier', ids.includes('outlier:project:proj-3'), ids);

// Evidence resolution — the foundation of the validation-reject rule.
const knownTagIds = new Set(fixtureA.tags.map((t) => t.tagId));
const knownImageIds = new Set(fixtureA.images.map((i) => i.imageId));
const knownProjectIds = new Set(fixtureA.projects.map((p) => p.projectId));
const knownProductIds = new Set(fixtureA.products.map((p) => p.productId));
const unresolved = digestA.signals.flatMap((s) => [
  ...(s.evidence.productTagIds ?? []).filter((id) => !knownTagIds.has(id)),
  ...(s.evidence.imageIds ?? []).filter((id) => !knownImageIds.has(id)),
  ...(s.evidence.projectIds ?? []).filter((id) => !knownProjectIds.has(id)),
  ...(s.evidence.productIds ?? []).filter((id) => !knownProductIds.has(id)),
]);
check('every evidence row ID resolves to a raw-layer row', unresolved.length === 0, unresolved);

check(
  'digest is deterministic (two runs, identical JSON)',
  JSON.stringify(buildCorpusDigest(fixtureA)) === JSON.stringify(digestA)
);

// ─── Fixture B: mature corpus (8 stories, 100+ tags, engagement) ────────────
// Early projects lean chrome, late projects lean brass (evolution), and one
// image's products carry outsized saves (save-delta).

const fixtureBProjects: FixtureSpec['projects'] = [];
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
const fixtureB = makeRaw({
  products: [brassTap, brassPull, oakStool, chromeSconce],
  projects: fixtureBProjects,
  productSaves: { 'prod-tap': 6, 'prod-pull': 5, 'prod-stool': 0, 'prod-sconce': 0 },
});

console.log('\nFixture B — mature corpus (8 stories, 100+ tags, engagement)');
const digestB = buildCorpusDigest(fixtureB);

check('8 stories counted', digestB.maturity.publishedStoryCount === 8);
check('100+ tags counted', digestB.maturity.tagCount >= 100, digestB.maturity.tagCount);
check('engagement detected', digestB.maturity.hasEngagementData);
check(
  'save_delta and evolution eligible on mature corpus',
  digestB.maturity.eligibleSignalTypes.includes('save_delta') &&
    digestB.maturity.eligibleSignalTypes.includes('evolution'),
  digestB.maturity
);
const idsB = digestB.signals.map((s) => s.id);
check('brass rising evolution fires', idsB.includes('evo:finish:brass:rising'), idsB);
check('chrome receding evolution fires', idsB.includes('evo:finish:chrome:receding'), idsB);
check('save-delta fires on a high-save image', idsB.some((id) => id.startsWith('sd:image:')), idsB);
check(
  'signals sorted by strength descending',
  digestB.signals.every((s, i, arr) => i === 0 || arr[i - 1].strength >= s.strength)
);

// ─── Result ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`✗ ${failures} check(s) failed`);
  process.exit(1);
}
console.log('✓ all digest checks passed');
