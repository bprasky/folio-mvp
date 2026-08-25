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
// Fixtures live in ./fixtures/digestCorpus so the churn report measures the same
// corpus this check guards, rather than a lookalike that would drift.
import { fixtureA, fixtureB } from './fixtures/digestCorpus';

let failures = 0;
function check(name: string, condition: boolean, context?: unknown) {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, context !== undefined ? JSON.stringify(context, null, 2) : '');
  }
}

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
