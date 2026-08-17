#!/usr/bin/env tsx
/**
 * Product Record structural invariants (spec 22_PRODUCT_RECORD).
 *
 * Usage:
 *   npx tsx scripts/check-product-record-invariants.ts        # human-readable
 *   npx tsx scripts/check-product-record-invariants.ts --ci   # exit 1 on any violation
 *
 * Two of spec 22's invariants cannot be expressed as a database constraint or a
 * type. They are enforced here, in the pattern of the existing check:* suite,
 * because "enforce structurally, not by policy" means a build that fails rather
 * than a paragraph someone reads once.
 *
 * CHECK 1 — Targeting firewall (Ordering Invariant 4).
 * Private product signal must never be an input to collaboration targeting or
 * recommendation. Once private signal accumulates, Folio can predict sentiment;
 * if that prediction becomes a targeting input, a vendor buys a filtered sample
 * and the record is whitewashed by construction — nothing suppressed, no rule
 * broken, and no way to see it happened from the outside. The firewall has to be
 * structural because the failure leaves no trace.
 *
 * CHECK 2 — Gate placement.
 * The testimony gate belongs in the serializer, not in a component. A component
 * that filters testimony on render has already put the words in the RSC payload,
 * where anyone can read them without the UI's help. Same doctrine as the
 * `resolveProductImage` gate: enforce in server queries/serializers, never in
 * components.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CI = process.argv.includes('--ci');

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (SOURCE_EXTENSIONS.some((e) => full.endsWith(e))) out.push(full.replace(/\\/g, '/'));
  }
  return out;
}

// ── CHECK 1: targeting firewall ─────────────────────────────────────────────

/**
 * Surfaces that rank, recommend, target, or price. Anything that decides WHO a
 * vendor is shown, or WHAT is shown to whom, belongs on this list. Adding a new
 * ranking surface without adding it here is the quiet way to lose the firewall,
 * so the list is deliberately broad.
 */
const TARGETING_SURFACES = [
  'src/lib/boost',
  'src/lib/directory',
  'src/lib/feed',
  'src/lib/homepage',
  'src/lib/intelligence',
  'src/lib/recommendations',
  'src/lib/search',
  'src/lib/suggestions',
  'src/lib/vendor',
  'src/jobs',
];

/**
 * Tokens that mean "you are reading private product signal". The Prisma
 * delegate, the table, and the model name all count — reaching the table through
 * $queryRaw is the same violation as reaching it through the client.
 */
const PRIVATE_SIGNAL_TOKENS = [
  'privateProductSignal',
  'private_product_signals',
  'PrivateProductSignal',
];

interface Violation {
  file: string;
  line: number;
  detail: string;
}

const firewallViolations: Violation[] = [];

for (const surface of TARGETING_SURFACES) {
  for (const file of walk(surface)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      for (const token of PRIVATE_SIGNAL_TOKENS) {
        if (text.includes(token)) {
          firewallViolations.push({
            file,
            line: i + 1,
            detail: `reads private product signal (\`${token}\`)`,
          });
          return;
        }
      }
    });
  }
}

// ── CHECK 2: gate placement ─────────────────────────────────────────────────

const GATE_FUNCTION = 'isTestimonyVisible';
/** The one module allowed to define it, and the query layer allowed to call it. */
const GATE_DEFINITION = 'src/lib/products/productRecord.ts';
const GATE_ALLOWED_CALLERS = ['src/server/', 'src/lib/products/', 'scripts/'];

const gateViolations: Violation[] = [];

for (const file of [...walk('src'), ...walk('scripts')]) {
  if (file === GATE_DEFINITION) continue;
  if (GATE_ALLOWED_CALLERS.some((prefix) => file.startsWith(prefix))) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    if (text.includes(GATE_FUNCTION)) {
      gateViolations.push({
        file,
        line: i + 1,
        detail: `calls \`${GATE_FUNCTION}\` outside the serializer — gate the payload, not the render`,
      });
    }
  });
}

// ── CHECK 3: gate and ladder truth table ────────────────────────────────────
//
// The rules in productRecord.ts are the ones that decide who reads a designer's
// words and whether a vendor can manufacture an article. They are pure
// functions, so they are asserted here rather than described. This project has
// no test runner configured (see tasks/todo.md); when one lands, this block
// moves into it unchanged.

const behaviourViolations: Violation[] = [];

function assert(condition: boolean, detail: string) {
  if (!condition) {
    behaviourViolations.push({ file: GATE_DEFINITION, line: 0, detail });
  }
}

{
  /* eslint-disable @typescript-eslint/no-var-requires */
  const {
    isTestimonyVisible,
    evaluateRecordTier,
    coverageDisclosure,
    rankTestimony,
  } = require('../src/lib/products/productRecord') as typeof import('../src/lib/products/productRecord');

  const AUDIENCES = ['PUBLIC', 'DESIGNER', 'VENDOR_OWNER'] as const;
  const STATES = ['TAGGED', 'CLAIMED', 'COLLABORATING'] as const;
  const CLASSES = ['VOLUNTEER', 'COMMISSIONED'] as const;

  for (const audience of AUDIENCES) {
    for (const state of STATES) {
      for (const klass of CLASSES) {
        // A designer reads everything. Commissioned testimony published because
        // a request was paid for and is not re-gated on the vendor's current
        // state. Volunteer quotes go public exactly when the vendor claims.
        const expected =
          audience === 'DESIGNER' ? true : klass === 'COMMISSIONED' ? true : state !== 'TAGGED';
        const actual = isTestimonyVisible(audience, state, klass);
        assert(
          actual === expected,
          `isTestimonyVisible(${audience}, ${state}, ${klass}) = ${actual}, expected ${expected}`,
        );
      }
    }
  }

  const spec = (designerId: string, projectId: string) => ({ designerId, projectId });
  const commissioned = (designerId: string) =>
    ({ designerId, testimonyClass: 'COMMISSIONED' }) as const;
  const volunteer = (designerId: string) => ({ designerId, testimonyClass: 'VOLUNTEER' }) as const;

  assert(
    evaluateRecordTier({ specifications: [], testimony: [] }) === 'LISTING',
    'a product with no specification events is a LISTING',
  );
  assert(
    evaluateRecordTier({ specifications: [spec('d1', 'p1')], testimony: [] }) === 'RECORD',
    'one specification event makes a RECORD',
  );
  assert(
    evaluateRecordTier({
      specifications: [spec('d1', 'p1'), spec('d2', 'p2'), spec('d3', 'p3')],
      testimony: [volunteer('d1'), volunteer('d2'), volunteer('d3')],
    }) === 'RECORD',
    'volunteer quotes alone never reach ARTICLE, however many there are',
  );
  assert(
    evaluateRecordTier({
      specifications: [spec('d1', 'p1'), spec('d2', 'p2'), spec('d3', 'p3')],
      testimony: [commissioned('d1'), commissioned('d2')],
    }) === 'ARTICLE',
    '3 designers, 3 projects, 2 commissioned from 2 designers is an ARTICLE',
  );
  assert(
    evaluateRecordTier({
      specifications: [spec('d1', 'p1'), spec('d2', 'p2'), spec('d3', 'p3')],
      testimony: [commissioned('d1'), commissioned('d1')],
    }) === 'RECORD',
    'two commissioned testimonies from ONE designer do not clear the independence gate',
  );
  assert(
    evaluateRecordTier({
      specifications: [spec('d1', 'p1'), spec('d1', 'p2'), spec('d1', 'p3')],
      testimony: [commissioned('d1'), commissioned('d2')],
    }) === 'RECORD',
    'one designer across three projects does not clear the independence gate',
  );
  assert(
    evaluateRecordTier({
      specifications: [spec('d1', 'p1'), spec('d2', 'p1'), spec('d3', 'p1')],
      testimony: [commissioned('d1'), commissioned('d2')],
    }) === 'RECORD',
    'three designers on ONE project does not clear the independence gate',
  );

  assert(
    coverageDisclosure({ specifierCount: 0, projectCount: 0, testimonyCount: 0 }) ===
      'Not yet specified on Folio.',
    'an unspecified product says so',
  );
  assert(
    coverageDisclosure({ specifierCount: 1, projectCount: 1, testimonyCount: 0 }) ===
      'Specified by 1 designer across 1 project. None have testified yet.',
    'the zero-testimony case is stated, never omitted',
  );
  assert(
    coverageDisclosure({ specifierCount: 40, projectCount: 47, testimonyCount: 6 }) ===
      'Specified by 40 designers across 47 projects. 6 have testified.',
    'the coverage sentence matches the spec verbatim',
  );
  assert(
    coverageDisclosure({ specifierCount: 2, projectCount: 2, testimonyCount: 1 }) ===
      'Specified by 2 designers across 2 projects. 1 has testified.',
    'singular testimony agrees with its verb',
  );

  const now = new Date('2026-08-17T00:00:00Z');
  const twoYearsAgo = new Date('2024-08-01T00:00:00Z');
  const lastWeek = new Date('2026-08-10T00:00:00Z');
  const ranked = rankTestimony(
    [
      { id: 'volunteer-fresh', testimonyClass: 'VOLUNTEER', hasInstallShot: false, createdAt: lastWeek },
      { id: 'volunteer-aged-shot', testimonyClass: 'VOLUNTEER', hasInstallShot: true, createdAt: twoYearsAgo },
      { id: 'commissioned-fresh', testimonyClass: 'COMMISSIONED', hasInstallShot: false, createdAt: lastWeek },
    ] as Array<{ id: string; testimonyClass: 'VOLUNTEER' | 'COMMISSIONED'; hasInstallShot: boolean; createdAt: Date }>,
    now,
  );
  assert(
    ranked[0].id === 'commissioned-fresh',
    'commissioned testimony outranks volunteer testimony',
  );
  assert(
    ranked[1].id === 'volunteer-aged-shot' && ranked[2].id === 'volunteer-fresh',
    'an aged quote with an install shot outranks a fresh quote without one',
  );
}

// ── Report ──────────────────────────────────────────────────────────────────

function report(title: string, violations: Violation[], remedy: string) {
  console.log(`\n${title}: ${violations.length} violation(s)`);
  for (const v of violations) {
    console.log(`  - ${v.file}:${v.line} — ${v.detail}`);
  }
  if (violations.length > 0) console.log(`  Remedy: ${remedy}`);
}

console.log('Product Record invariants (spec 22_PRODUCT_RECORD)');

report(
  'Check 1 — Targeting firewall (Ordering Invariant 4)',
  firewallViolations,
  'targeting runs on observed specification and relevance only. Remove the read.',
);

report(
  'Check 2 — Testimony gate placement',
  gateViolations,
  `apply the gate in getProductRecord and pass the already-filtered view down.`,
);

report(
  'Check 3 — Gate and ladder truth table',
  behaviourViolations,
  'src/lib/products/productRecord.ts no longer matches spec 22. Fix the rule, not the assertion.',
);

const total = firewallViolations.length + gateViolations.length + behaviourViolations.length;

if (CI) {
  if (total > 0) {
    console.error(`\n[check-product-record-invariants] ${total} violation(s). Failing.`);
    process.exit(1);
  }
  console.log('\n[check-product-record-invariants] clean.');
}
