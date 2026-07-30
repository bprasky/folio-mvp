/**
 * Regression check for LLM_REPAIR_FAILED on multi-room projects.
 *
 * The production failure this guards (correlation generate_019bb0c31bfc, project
 * dda4b29e, 10 write rooms): generation and JSON parsing both succeeded, then
 * `repairAndBuildBlocks` threw Zod `too_big` — `pullQuotes` had <=5 items allowed
 * but the pipeline had derived 10.
 *
 * `blocks.pullQuotes` is NOT an editorial selection the model authors — the prompt
 * explicitly forbids the model from emitting it. It is a DERIVED INDEX built by
 * `syncPullQuotesFromChapters` as one entry per gallery chapter, plus the hook
 * quote at position 0. `galleryChapters` is uncapped (a house has as many rooms as
 * it has), so capping its derived index at 5 put a hard ceiling of ~4 rooms on the
 * whole product.
 *
 * Truncating the index would be the wrong fix: `layoutEngine.ts` looks entries up
 * by `sourceSection` (chapter title) as its legacy fallback, so dropping entries
 * silently breaks that lookup for later chapters.
 *
 * Run: npm run check:blocks-bounds
 */

import { BlocksSchema, syncPullQuotesFromChapters } from '../src/lib/posting/schemas';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

// The 10 rooms this project actually generates, from the production log's
// `[generate] append-only split` writeRooms.
const WRITE_ROOMS = [
  'Dining Room', 'Living Room', 'Primary Bathroom', 'Stairway', 'Kitchen',
  'Primary Bedroom', 'Exterior', 'Powder Room', 'Entry', 'Formal Living Room',
];

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function buildDraft(roomNames: string[]) {
  return {
    lead: { kicker: 'A house that learned to hold its own quiet', deck: 'A renovation.' },
    introduction: ['Opening paragraph.', 'Second paragraph.'],
    galleryChapters: roomNames.map((room, i) => ({
      title: room,
      imageIds: [uuid(i + 1)],
      body: [`${room} narrative paragraph.`],
      pullQuote: {
        selected: { text: `We wanted the ${room.toLowerCase()} to feel settled, not staged.`, context: 'Matto' },
        alternatives: [],
      },
    })),
    hookQuote: { text: 'We were chasing a feeling, not a look.', context: 'Matto' },
    credits: [{ role: 'Designer', name: 'Diano Matto' }],
  } as Record<string, any>;
}

console.log('\n1. The derived index has one entry per chapter, plus the hook quote');

const draft = buildDraft(WRITE_ROOMS);
syncPullQuotesFromChapters(draft);

check(
  `10 rooms derive ${WRITE_ROOMS.length + 1} pull quotes (hook + one per chapter)`,
  draft.pullQuotes.length === WRITE_ROOMS.length + 1,
  `got ${draft.pullQuotes.length}`,
);
check(
  'the hook quote holds index 0 with no sourceSection (buildRoomTiles reads it as the lead)',
  draft.pullQuotes[0].sourceSection === undefined &&
    draft.pullQuotes[0].text === 'We were chasing a feeling, not a look.',
  JSON.stringify(draft.pullQuotes[0]),
);
check(
  'every chapter is represented, so the sourceSection lookup in layoutEngine resolves',
  WRITE_ROOMS.every(room => draft.pullQuotes.some((q: any) => q.sourceSection === room)),
  `missing: ${WRITE_ROOMS.filter(room => !draft.pullQuotes.some((q: any) => q.sourceSection === room)).join(', ')}`,
);

console.log('\n2. A realistic multi-room draft validates (this is what regressed)');

const result = BlocksSchema.safeParse(draft);
check(
  'the 10-room draft passes BlocksSchema',
  result.success,
  result.success ? '' : JSON.stringify(result.error.issues.map(i => ({ path: i.path, code: i.code, message: i.message }))),
);

console.log('\n3. Room counts across the realistic range all validate');

for (const count of [1, 4, 5, 6, 10, 20, 37]) {
  const d = buildDraft(WRITE_ROOMS.slice(0, Math.min(count, WRITE_ROOMS.length)).concat(
    Array.from({ length: Math.max(0, count - WRITE_ROOMS.length) }, (_, i) => `Room ${i + 11}`),
  ));
  syncPullQuotesFromChapters(d);
  const r = BlocksSchema.safeParse(d);
  check(
    `${count} rooms → ${d.pullQuotes.length} pull quotes, validates`,
    r.success,
    r.success ? '' : JSON.stringify(r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)),
  );
}

console.log('\n4. Per-entry constraints still bind (the cap was the only thing loosened)');

const overlong = buildDraft(['Kitchen']);
overlong.galleryChapters[0].pullQuote = { selected: { text: 'x'.repeat(301), context: 'Matto' }, alternatives: [] };
syncPullQuotesFromChapters(overlong);
check(
  'a >300 char pull quote is still rejected',
  !BlocksSchema.safeParse(overlong).success,
);

const badContext = buildDraft(['Kitchen']);
syncPullQuotesFromChapters(badContext);
badContext.pullQuotes[0].context = 'y'.repeat(81);
check(
  'a >80 char context is still rejected',
  !BlocksSchema.safeParse(badContext).success,
);

const unknownKey = buildDraft(['Kitchen']);
syncPullQuotesFromChapters(unknownKey);
unknownKey.somethingUnexpected = true;
check(
  'BlocksSchema is still strict about unknown top-level keys',
  !BlocksSchema.safeParse(unknownKey).success,
);

console.log(
  failures === 0
    ? '\nAll editorial blocks-bounds checks passed.\n'
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
