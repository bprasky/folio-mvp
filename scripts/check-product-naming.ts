// Fixture-driven check for the Product Naming Gate (spec 20).
// Pure-layer only (no Prisma, no network) — run with:
//   npm run check:naming   (tsx scripts/check-product-naming.ts)
//
// Proves the guarantees the gate depends on:
//   1. decideNaming — the two gate rules (subscription vs prose).
//   2. buildDescriptor — never empty; brand-free; emitted preferred.
//   3. scrubProseNaming — a non-eligible product's name (and vendor name) is
//      scrubbed from prose and replaced with a descriptor; a subscribed /
//      boosted / enterprise product stays named; credits and the materials
//      ledger are never scrubbed; a shared brand is preserved.

import { decideNaming, type ProductNaming } from '../src/lib/naming/namingRules';
import { buildDescriptor } from '../src/lib/naming/descriptor';
import { scrubProseNaming, type DescriptorHint } from '../src/lib/naming/scrubProse';
import { BlocksSchema, type Blocks } from '../src/lib/posting/schemas';

let failures = 0;
function check(name: string, condition: boolean, context?: unknown) {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, context !== undefined ? JSON.stringify(context, null, 2) : '');
  }
}

// ─── 1. decideNaming — the two gate rules ────────────────────────────────────

console.log('decideNaming — gate rules');

check(
  'subscription mode: named only when vendor subscribed',
  decideNaming({ vendorSubscribed: true, boostApproved: false, enterprise: false }, 'subscription').named === true &&
    decideNaming({ vendorSubscribed: false, boostApproved: true, enterprise: true }, 'subscription').named === false
);
check(
  'prose mode: subscribed OR boosted OR enterprise all name',
  decideNaming({ vendorSubscribed: true, boostApproved: false, enterprise: false }, 'prose').named === true &&
    decideNaming({ vendorSubscribed: false, boostApproved: true, enterprise: false }, 'prose').named === true &&
    decideNaming({ vendorSubscribed: false, boostApproved: false, enterprise: true }, 'prose').named === true
);
check(
  'prose mode: none of the three signals → not named',
  decideNaming({ vendorSubscribed: false, boostApproved: false, enterprise: false }, 'prose').named === false
);

// ─── 2. buildDescriptor — never empty, brand-free, emitted preferred ─────────

console.log('\nbuildDescriptor');

check(
  'category + finish assembles a brand-free descriptor',
  buildDescriptor({ category: 'pendant', colorFinish: 'Unlacquered Brass', name: 'Atwell Pendant' }) === 'a brass pendant'
);
check(
  'bare category is an acceptable floor',
  buildDescriptor({ category: 'pendant', colorFinish: null, name: 'Nondescript' }) === 'a pendant'
);
check(
  'never empty — absolute floor when nothing known',
  buildDescriptor({}) === 'the piece'
);
check(
  'generator-emitted descriptor is preferred (source 1)',
  buildDescriptor({ category: 'pendant', emitted: 'a clear glass globe pendant' }) === 'a clear glass globe pendant'
);

// ─── 3. scrubProseNaming — the guarantee ─────────────────────────────────────

console.log('\nscrubProseNaming');

const IMG = '00000000-0000-4000-8000-000000000001';

const naming = new Map<string, ProductNaming>([
  // Subscribed vendor → stays named.
  ['p-sub', { productId: 'p-sub', named: true, reason: 'vendor_subscribed', name: 'Atwell Collection Pendant', brand: 'Progress Lighting', vendorName: 'Progress Lighting', category: 'lighting' }],
  // Non-subscribed vendor → scrubbed.
  ['p-free', { productId: 'p-free', named: false, reason: 'not_eligible', name: 'Halcyon Sconce', brand: 'Rowan & Wren', vendorName: 'Rowan & Wren', category: 'sconce' }],
  // Boost-approved → stays named.
  ['p-boost', { productId: 'p-boost', named: true, reason: 'boost_approved', name: 'Marlow Sofa', brand: 'Ashford', vendorName: 'Ashford', category: 'seating' }],
]);

const hints = new Map<string, DescriptorHint>([
  ['p-free', { colorFinish: 'Brass' }],
]);

const blocks: Blocks = {
  lead: { kicker: 'A Study in Light', deck: 'The Halcyon Sconce by Rowan & Wren anchors the hall.' },
  introduction: [
    'The designer paired the Atwell Collection Pendant with a Halcyon Sconce by Rowan & Wren over the Marlow Sofa.',
  ],
  galleryChapters: [
    {
      title: 'The Hall',
      imageIds: [IMG],
      body: ['A Halcyon Sconce glows above the room, and the Marlow Sofa grounds it.'],
      pullQuote: 'The Rowan & Wren piece changed everything.',
    },
  ],
  // Credits must ALWAYS name everything, including the non-subscribed vendor.
  credits: [
    { role: 'Designer', name: 'Jane Doe' },
    { role: 'Vendor', name: 'Rowan & Wren' },
  ],
  // Materials ledger is product credits — never scrubbed.
  materialsLedger: { items: [{ name: 'Halcyon Sconce', productId: undefined, finish: 'brass sconce' }] },
  mode: 'recomposition',
};

const { blocks: scrubbed, replacements } = scrubProseNaming(blocks, naming, hints);
const proseText = JSON.stringify({
  lead: scrubbed.lead,
  introduction: scrubbed.introduction,
  galleryChapters: scrubbed.galleryChapters,
});

check('at least one replacement was made', replacements > 0, { replacements });
check("non-subscribed product NAME scrubbed from prose", !proseText.includes('Halcyon Sconce'), proseText);
check("non-subscribed VENDOR name scrubbed from prose", !proseText.includes('Rowan & Wren'), proseText);
check('descriptor swapped in where the name was', proseText.toLowerCase().includes('a brass sconce'), proseText);
check('no doubled article left behind (e.g. "The a ...")', !/\b(the|a|an)\s+a\s+brass\s+sconce/i.test(proseText), proseText);
check('subscribed product stays named in prose', proseText.includes('Atwell Collection Pendant'), proseText);
check('boosted product stays named in prose', proseText.includes('Marlow Sofa'), proseText);

// Credits + materials ledger are never scrubbed — the tag/attribution is the allure.
check(
  'credits still name the non-subscribed vendor',
  (scrubbed.credits ?? []).some((c) => c.name === 'Rowan & Wren'),
  scrubbed.credits
);
check(
  'materials ledger keeps the exact product name',
  (scrubbed.materialsLedger?.items ?? []).some((i) => i.name === 'Halcyon Sconce'),
  scrubbed.materialsLedger
);
// The scrub runs inside generateEditorialDraft, which re-validates with
// BlocksSchema.parse — a string-only transform must keep the shape valid.
check('scrubbed blocks remain BlocksSchema-valid', BlocksSchema.safeParse(scrubbed).success);

// ─── 4. Shared-brand safety ──────────────────────────────────────────────────
// A brand used by BOTH an eligible and an ineligible product must NOT be
// scrubbed — it can't be attributed to the ineligible one alone in free prose.

console.log('\nscrubProseNaming — shared-brand safety');

const sharedNaming = new Map<string, ProductNaming>([
  ['e', { productId: 'e', named: true, reason: 'vendor_subscribed', name: 'Aria Chair', brand: 'Shared Co', vendorName: 'Shared Co', category: 'seating' }],
  ['f', { productId: 'f', named: false, reason: 'not_eligible', name: 'Nimbus Table', brand: 'Shared Co', vendorName: 'Shared Co', category: 'table' }],
]);
const sharedBlocks: Blocks = {
  introduction: ['The Nimbus Table by Shared Co sits beside the Aria Chair by Shared Co.'],
  mode: 'recomposition',
};
const sharedOut = scrubProseNaming(sharedBlocks, sharedNaming).blocks;
const sharedText = (sharedOut.introduction ?? []).join(' ');

check('ineligible product name scrubbed', !sharedText.includes('Nimbus Table'), sharedText);
check('eligible product name preserved', sharedText.includes('Aria Chair'), sharedText);
check('shared brand preserved (not scrubbed)', sharedText.includes('Shared Co'), sharedText);

// ─── 5. Interview descriptor path ────────────────────────────────────────────
// A non-subscribed product used as the designer's story is referred to by
// descriptor, never named — the labeling the interview generator receives.

console.log('\ninterview descriptor labeling');

const interviewDecision = decideNaming({ vendorSubscribed: false, boostApproved: false, enterprise: false }, 'subscription');
const interviewDescriptor = buildDescriptor({ category: 'pendant', colorFinish: 'Clear Glass', name: 'Atwell Pendant' });
check(
  'non-subscribed product is descriptor-only in the interview',
  interviewDecision.named === false && interviewDescriptor.length > 0 && !interviewDescriptor.toLowerCase().includes('atwell')
);

// ─── Result ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`✗ ${failures} check(s) failed`);
  process.exit(1);
}
console.log('✓ all product-naming-gate checks passed');
