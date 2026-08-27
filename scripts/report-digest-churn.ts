/**
 * Signal churn across a MATERIAL_CLASSES change.
 *
 * The B4 audit established that adding a material class is NOT strictly additive.
 * Repetition is additive and positioning is untouched, but three consumers can move
 * signals for families that have nothing to do with the new term:
 *
 *   Outlier   — a Jaccard distance over `finish:` traits, so a new trait shifts
 *               every pairwise distance (PROJECT_OUTLIER_MIN_DISTANCE = 0.6).
 *   Singular  — gated on a GLOBAL `repeatedFamilies >= 2`, which a new family can
 *               flip on, enabling signals for other families entirely.
 *   Evolution — divides by a total counting only non-null families, so a new class
 *               lowers every other family's share in both halves and can push a
 *               delta under EVOLUTION_MIN_DELTA = 0.15.
 *
 * This makes that visible instead of leaving it to be discovered in production.
 * Run it before a vocabulary change with --out, then again after with --baseline.
 *
 *   npx tsx scripts/report-digest-churn.ts --out /tmp/before.json
 *   ...edit MATERIAL_CLASSES...
 *   npx tsx scripts/report-digest-churn.ts --baseline /tmp/before.json
 *
 * Measures the SAME fixtures `check:digest` exercises (./fixtures/digestCorpus),
 * plus a probe corpus that deliberately contains the terms under discussion — the
 * real fixtures may contain none of them, in which case zero churn is a fact about
 * the fixtures rather than evidence the mechanism is inert.
 *
 * Pure: no Prisma, no network, no API key.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { buildCorpusDigest } from '../src/lib/editorial-queue/buildCorpusDigest';
import { fixtureA, fixtureB, makeProduct, makeRaw, type FixtureSpec } from './fixtures/digestCorpus';
import { MATERIAL_CLASSES, materialClassOf } from '../src/lib/editorial-queue/signals';

interface Snapshot {
  corpora: Record<string, { byType: Record<string, number>; ids: string[] }>;
  vocabulary: string[];
}

/**
 * A probe corpus built to EXERCISE the consumers that can churn.
 *
 * A uniform corpus produces zero churn no matter what the vocabulary does, so it
 * proves nothing. This one is engineered so the evolution consumer is live and
 * sensitive:
 *
 *   Early half (4 projects): 20 classified tags — brass 4 (20%), chrome 16 (80%).
 *   Late half  (4 projects): 20 classified tags — brass 8 (40%), chrome 12 (60%),
 *                            PLUS 10 steel/terrazzo tags.
 *
 * The steel and terrazzo tags are present in BOTH runs. What changes is only
 * whether the vocabulary resolves them, and therefore whether they count toward
 * `total` in `familyShares`.
 *
 *   before: brass late = 8/20 = 40%, delta +0.20 -> fires (>= 0.15)
 *   after:  brass late = 8/30 = 27%, delta +0.07 -> GONE
 *
 * Brass has nothing to do with steel or terrazzo. That is the churn the B4 audit
 * predicted, made reproducible.
 */
function buildProbeCorpus() {
  const brass = makeProduct('p-brass', 'Unlacquered Brass Faucet', {
    colorFinish: 'Unlacquered Brass', category: 'Plumbing',
  });
  const chrome = makeProduct('p-chrome', 'Polished Chrome Sconce', {
    colorFinish: 'Polished Chrome', category: 'Lighting',
  });
  const steelRange = makeProduct('p-steel', 'Stainless Steel Range', {
    colorFinish: 'Brushed Steel', category: 'Appliance',
  });
  const terrazzoFloor = makeProduct('p-terrazzo', 'Terrazzo Floor Tile', {
    colorFinish: 'Grey Terrazzo', category: 'Flooring',
  });

  const projects: FixtureSpec['projects'] = [];
  for (let i = 1; i <= 8; i++) {
    const late = i > 4;
    // Per project: early = 1 brass + 4 chrome; late = 2 brass + 3 chrome + 2.5 new.
    const ids: string[] = late
      ? ['p-brass', 'p-brass', 'p-chrome', 'p-chrome', 'p-chrome',
         'p-steel', 'p-steel', 'p-terrazzo', ...(i % 2 === 0 ? ['p-terrazzo'] : [])]
      : ['p-brass', 'p-chrome', 'p-chrome', 'p-chrome', 'p-chrome'];
    projects.push({
      id: `pp-${i}`,
      title: `Probe ${i}`,
      publishedAt: `2026-${String(i).padStart(2, '0')}-01T00:00:00.000Z`,
      roomTypes: ['KITCHEN'],
      images: [{ id: `pi-${i}`, roomType: 'KITCHEN', productIds: ids }],
    });
  }
  return makeRaw({ products: [brass, chrome, steelRange, terrazzoFloor], projects });
}

function snapshotOf(raw: ReturnType<typeof buildProbeCorpus>) {
  const digest = buildCorpusDigest(raw);
  const byType: Record<string, number> = {};
  for (const s of digest.signals) byType[s.type] = (byType[s.type] ?? 0) + 1;
  return { byType, ids: digest.signals.map((s) => s.id).sort() };
}

function take(): Snapshot {
  return {
    vocabulary: [...MATERIAL_CLASSES],
    corpora: {
      'fixtureA (check:digest)': snapshotOf(fixtureA),
      'fixtureB (check:digest)': snapshotOf(fixtureB),
      'probe (engineered to churn)': snapshotOf(buildProbeCorpus()),
    },
  };
}

function printSnapshot(snap: Snapshot) {
  for (const [name, c] of Object.entries(snap.corpora)) {
    const total = Object.values(c.byType).reduce((a, b) => a + b, 0);
    console.log(`\n  ${name} — ${total} signals`);
    for (const [type, n] of Object.entries(c.byType).sort()) {
      console.log(`    ${type.padEnd(18)} ${String(n).padStart(3)}`);
    }
  }
}

/** How each fixture product's class resolves — the reason churn is or is not zero. */
function printResolution() {
  console.log('\n  Fixture product resolution under the current vocabulary:');
  for (const p of [...fixtureA.products, ...buildProbeCorpus().products]) {
    const cls = materialClassOf(p.colorFinish, p.name);
    console.log(`    ${p.name.padEnd(34)} -> ${cls ?? 'null'}`);
  }
}

const argv = process.argv;
const outIdx = argv.indexOf('--out');
const baseIdx = argv.indexOf('--baseline');
const snap = take();

console.log(`\nDIGEST SIGNAL CHURN — vocabulary of ${snap.vocabulary.length} material classes`);
printSnapshot(snap);
printResolution();

if (outIdx >= 0 && argv[outIdx + 1]) {
  writeFileSync(argv[outIdx + 1], JSON.stringify(snap, null, 2));
  console.log(`\n  snapshot written to ${argv[outIdx + 1]}\n`);
}

if (baseIdx >= 0 && argv[baseIdx + 1]) {
  const path = argv[baseIdx + 1];
  if (!existsSync(path)) {
    console.error(`\n  no baseline at ${path}\n`);
    process.exit(2);
  }
  const before: Snapshot = JSON.parse(readFileSync(path, 'utf8'));
  const added = snap.vocabulary.filter((v) => !before.vocabulary.includes(v));
  const removed = before.vocabulary.filter((v) => !snap.vocabulary.includes(v));

  console.log('\n  ── CHURN ──────────────────────────────────────────────────');
  console.log(`  vocabulary: +${added.length} [${added.join(', ') || '-'}]  -${removed.length} [${removed.join(', ') || '-'}]`);

  let churned = 0;
  for (const [name, after] of Object.entries(snap.corpora)) {
    const prev = before.corpora[name];
    if (!prev) { console.log(`\n  ${name}: NEW corpus, no baseline`); continue; }
    const gained = after.ids.filter((id) => !prev.ids.includes(id));
    const lost = prev.ids.filter((id) => !after.ids.includes(id));
    console.log(`\n  ${name}: +${gained.length} / -${lost.length}`);
    // A signal is "related" if its id names one of the added terms. Anything else
    // moving is churn in an unrelated family — the thing worth naming.
    const relates = (id: string) => added.some((t) => id.toLowerCase().includes(t.toLowerCase()));
    for (const id of gained) {
      const tag = relates(id) ? '' : '   <-- UNRELATED FAMILY';
      console.log(`      + ${id}${tag}`);
      if (!relates(id)) churned++;
    }
    for (const id of lost) {
      const tag = relates(id) ? '' : '   <-- UNRELATED FAMILY';
      console.log(`      - ${id}${tag}`);
      if (!relates(id)) churned++;
    }
    for (const type of new Set([...Object.keys(prev.byType), ...Object.keys(after.byType)])) {
      const a = prev.byType[type] ?? 0, b = after.byType[type] ?? 0;
      if (a !== b) console.log(`      ${type}: ${a} -> ${b}`);
    }
  }
  console.log(`\n  signals moved in families unrelated to the added terms: ${churned}\n`);
}
