// Fixture check for the Editorial Queue angle validation-reject rule and the
// pure prompt/parse helpers. No API, no Prisma — run with:
//   npm run check:angles   (tsx scripts/check-editorial-queue-angles.ts)
//
// The validation-reject rule is the hallucination guard the whole system leans
// on (it guarantees DesignerAngle.evidence resolves to real rows), so it is
// tested independently of the model call.

import { validateAngles } from '../src/lib/editorial-queue/validateAngles';
import { buildAngleUserPrompt, parseAngleResponse } from '../src/lib/editorial-queue/extractAngles';
import type { CandidateAngle, ComputedSignal, CorpusDigest } from '../src/lib/editorial-queue/types';

let failures = 0;
function check(name: string, condition: boolean, context?: unknown) {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, context !== undefined ? JSON.stringify(context, null, 2) : '');
  }
}

// ─── Signal fixtures ─────────────────────────────────────────────────────────

const signals: ComputedSignal[] = [
  {
    id: 'rep:finish:brass',
    type: 'repetition',
    headline: 'brass in 3 of 3 projects',
    detail: 'material loyalty',
    strength: 0.9,
    evidence: {
      productTagIds: ['tag-1', 'tag-2'],
      projectIds: ['proj-1', 'proj-2', 'proj-3'],
      facts: { finishFamily: 'brass' },
    },
  },
  {
    id: 'outlier:project:proj-3',
    type: 'outlier',
    headline: '"Marlow" breaks the pattern',
    detail: 'the departure is the story',
    strength: 0.7,
    evidence: { projectIds: ['proj-3'], facts: { distance: 0.72 } },
  },
];

// ─── Validation-reject rule ──────────────────────────────────────────────────

console.log('validateAngles — the hallucination guard');

const candidates: CandidateAngle[] = [
  // valid: cites two real signals
  { angleType: 'material_loyalty', summary: 'The brass thread', signalIds: ['rep:finish:brass', 'outlier:project:proj-3'], confidence: 0.8 },
  // rejected: fabricated citation
  { angleType: 'evolution', summary: 'Made-up trend', signalIds: ['rep:finish:brass', 'evo:finish:oak:rising'], confidence: 0.6 },
  // rejected: no citation
  { angleType: 'philosophy', summary: 'Ungrounded musing', signalIds: [], confidence: 0.5 },
  // rejected: unknown angle type
  { angleType: 'vibes', summary: 'Not a real type', signalIds: ['rep:finish:brass'], confidence: 0.5 },
  // rejected: empty summary
  { angleType: 'process', summary: '   ', signalIds: ['rep:finish:brass'], confidence: 0.5 },
];

const result = validateAngles(candidates, signals);

check('exactly one angle accepted', result.accepted.length === 1, result.accepted.map((a) => a.summary));
check('four angles rejected', result.rejected.length === 4, result.rejected.map((r) => r.reason));
check(
  'fabricated citation rejects the whole angle',
  result.rejected.some((r) => r.reason === 'fabricated_citation' && r.fabricatedIds?.includes('evo:finish:oak:rising')),
  result.rejected,
);
check('no-citation angle rejected', result.rejected.some((r) => r.reason === 'no_valid_citation'));
check('unknown angle type rejected', result.rejected.some((r) => r.reason === 'unknown_angle_type'));
check('empty summary rejected', result.rejected.some((r) => r.reason === 'empty_summary'));

const accepted = result.accepted[0];
check('accepted angle resolves evidence from BOTH cited signals', accepted.evidence.projectIds?.length === 3, accepted.evidence);
check('accepted evidence carries product tag rows', (accepted.evidence.productTagIds ?? []).includes('tag-1'));
check('accepted evidence facts are namespaced by signal id', !!accepted.evidence.facts?.['rep:finish:brass.finishFamily']);
check('confidence preserved and in range', accepted.confidence === 0.8);
check('isFresh defaults true', accepted.isFresh === true);

// Every evidence id on an accepted angle must trace back to a real signal's
// evidence — the invariant that makes DesignerAngle.evidence verifiable.
const knownTagIds = new Set(signals.flatMap((s) => s.evidence.productTagIds ?? []));
const knownProjectIds = new Set(signals.flatMap((s) => s.evidence.projectIds ?? []));
const leaked = [
  ...(accepted.evidence.productTagIds ?? []).filter((id) => !knownTagIds.has(id)),
  ...(accepted.evidence.projectIds ?? []).filter((id) => !knownProjectIds.has(id)),
];
check('accepted evidence contains no ids absent from cited signals', leaked.length === 0, leaked);

// confidence clamping
const clamped = validateAngles(
  [{ angleType: 'philosophy', summary: 'ok', signalIds: ['rep:finish:brass'], confidence: 5 }],
  signals,
);
check('out-of-range confidence clamped to 1', clamped.accepted[0]?.confidence === 1);

// ─── Prompt + parse helpers ──────────────────────────────────────────────────

console.log('\nbuildAngleUserPrompt / parseAngleResponse');

const digest: CorpusDigest = {
  designerId: 'designer-1',
  maturity: { publishedStoryCount: 3, tagCount: 12, hasEngagementData: false, eligibleSignalTypes: ['repetition', 'outlier'] },
  raw: {
    designer: { id: 'designer-1', name: 'Test', bio: 'Warm, natural materials.', studio: null, title: null, location: null, specialties: ['kitchens'] },
    projects: [
      { projectId: 'proj-1', title: 'Hobbs House', category: null, budgetBand: 'LUXURY', stage: 'install', city: null, regionState: null, createdAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-01T00:00:00.000Z', postVariant: 'PROJECT_FEATURE', roomTypes: ['KITCHEN'], tagCount: 6, saveCount: 0 },
    ],
    images: [], tags: [], products: [], interviewAnswers: [], priorQueuePieces: [], productSaves: {},
  },
  signals,
};

const prompt = buildAngleUserPrompt(digest);
check('prompt lists every signal id', signals.every((s) => prompt.includes(s.id)), prompt);
check('prompt includes designer positioning', prompt.includes('natural materials'));
check('prompt includes published project title', prompt.includes('Hobbs House'));

const parsed = parseAngleResponse('```json\n{"angles":[{"angleType":"material_loyalty","summary":"x","signalIds":["rep:finish:brass"],"confidence":0.7}]}\n```');
check('parses fenced JSON', parsed.length === 1 && parsed[0].signalIds[0] === 'rep:finish:brass');
check('parses malformed JSON to empty array', parseAngleResponse('not json').length === 0);
check('drops non-string signalIds', parseAngleResponse('{"angles":[{"angleType":"process","summary":"y","signalIds":[1,"rep:finish:brass",null]}]}')[0].signalIds.length === 1);

// End-to-end on the parsed output: parse → validate, the real pipeline shape.
const e2e = validateAngles(
  parseAngleResponse('{"angles":[{"angleType":"material_loyalty","summary":"The brass thread","signalIds":["rep:finish:brass"],"confidence":0.8},{"angleType":"evolution","summary":"fake","signalIds":["nope"],"confidence":0.5}]}'),
  signals,
);
check('parse→validate accepts the grounded angle only', e2e.accepted.length === 1 && e2e.rejected.length === 1);

// ─── Result ──────────────────────────────────────────────────────────────────

console.log('');
if (failures > 0) {
  console.error(`✗ ${failures} check(s) failed`);
  process.exit(1);
}
console.log('✓ all angle checks passed');
