/**
 * Regression check: a room's prose must belong to that room.
 *
 * The production failure this guards (project dda4b29e, 10 write rooms): every
 * chapter rendered the title and photographs of one room beside the prose of a
 * different one. "PRIMARY BATHROOM" sat over a bathroom photo and a paragraph
 * about the formal living room's fireplace; "DINING ROOM" over a dining photo
 * and a paragraph about the facade.
 *
 * Cause: `repairAndBuildBlocks` paired `writeRooms[i]` with
 * `composedChapters[i]` BY ARRAY INDEX, assuming the model returns chapters in
 * the order the prompt lists rooms. The model instead reorders into a narrative
 * walkthrough (exterior → entry → living room …). Title and images were keyed by
 * room name and so agreed with each other; only the body was positional, which
 * is why the mismatch reads as plausible until you look at the photo.
 *
 * The fix joins on the chapter title, which the prompt requires to name its room.
 * These checks assert the join is correct, that it survives the ambiguous
 * "Living Room" / "Formal Living Room" pair, and that an unmatchable room is
 * demoted to photo-only rather than given someone else's story.
 *
 * Run: npm run check:room-matching
 */

process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// The matcher, mirrored from repairAndBuildBlocks. Kept in step by check 0,
// which asserts the shipped source still contains the same join.
// ---------------------------------------------------------------------------
const normalizeRoomKey = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const containsRoomName = (title: string, room: string): boolean =>
  ` ${title} `.includes(` ${room} `);

function matchRoomsToChapters(writeRooms: string[], composedChapters: any[]) {
  const normChapters = composedChapters.map((ch, i) => ({ i, ch, norm: normalizeRoomKey(ch?.title) }));
  const roomToChapter = new Map<string, any>();
  const claimedChapterIdx = new Set<number>();
  const roomsBySpecificity = [...writeRooms].sort(
    (a, b) => normalizeRoomKey(b).length - normalizeRoomKey(a).length,
  );
  for (const pass of ['exact', 'contains'] as const) {
    for (const roomName of roomsBySpecificity) {
      if (roomToChapter.has(roomName)) continue;
      const target = normalizeRoomKey(roomName);
      if (!target) continue;
      const hit = normChapters.find(
        (c) =>
          !claimedChapterIdx.has(c.i) &&
          c.norm &&
          (pass === 'exact' ? c.norm === target : containsRoomName(c.norm, target)),
      );
      if (hit) {
        roomToChapter.set(roomName, hit.ch);
        claimedChapterIdx.add(hit.i);
      }
    }
  }
  return { roomToChapter, claimedChapterIdx, normChapters };
}

// The 10 rooms from the production log's `[generate] append-only split`.
const WRITE_ROOMS = [
  'Dining Room', 'Living Room', 'Primary Bathroom', 'Stairway', 'Kitchen',
  'Primary Bedroom', 'Exterior', 'Powder Room', 'Entry', 'Formal Living Room',
];

// The model's actual output order: a narrative walkthrough, NOT the prompt's
// room order. Bodies are tagged with their true room so a mismatch is legible.
const WALKTHROUGH_ORDER = [
  'Exterior', 'Entry', 'Formal Living Room', 'Living Room', 'Dining Room',
  'Kitchen', 'Stairway', 'Primary Bedroom', 'Primary Bathroom', 'Powder Room',
];
const composedChapters = WALKTHROUGH_ORDER.map((room) => ({
  title: room,
  body: [`PROSE-FOR:${room} first paragraph.`, `PROSE-FOR:${room} second paragraph.`],
}));

console.log('\n0. The shipped matcher still joins on title, not index');

import { readFileSync } from 'fs';
import { join } from 'path';
const source = readFileSync(join(__dirname, '../src/lib/posting/generateEditorialDraft.ts'), 'utf8');
check(
  'repairAndBuildBlocks no longer reads composedChapters by loop index',
  !/proofBody\(composedChapters\[i\]/.test(source),
  'found the positional read this check exists to prevent',
);
check(
  'it reads the title-matched chapter instead',
  /proofBody\(roomToChapter\.get\(roomName\)\?\.body\)/.test(source),
);

console.log('\n1. The production mismatch: walkthrough order vs. prompt order');

const { roomToChapter } = matchRoomsToChapters(WRITE_ROOMS, composedChapters);

check(
  'every one of the 10 rooms matched a chapter',
  roomToChapter.size === WRITE_ROOMS.length,
  `matched ${roomToChapter.size}/${WRITE_ROOMS.length}`,
);

const mismatched = WRITE_ROOMS.filter((room) => {
  const body: string[] = roomToChapter.get(room)?.body ?? [];
  return !body[0]?.includes(`PROSE-FOR:${room} `);
});
check(
  'every room receives ITS OWN prose',
  mismatched.length === 0,
  mismatched.map(r => `${r} ← ${roomToChapter.get(r)?.body?.[0]}`).join('; '),
);

// The three the designer reported, asserted individually.
for (const [room, wrong] of [
  ['Dining Room', 'Exterior'],
  ['Living Room', 'Entry'],
  ['Primary Bathroom', 'Formal Living Room'],
] as const) {
  const body: string[] = roomToChapter.get(room)?.body ?? [];
  check(
    `"${room}" gets ${room} prose, not ${wrong} prose (reported case)`,
    body[0]?.includes(`PROSE-FOR:${room} `) === true,
    body[0],
  );
}

console.log('\n2. Positional pairing would have produced exactly the reported bug');

const positional = WRITE_ROOMS.map((room, i) => ({ room, body: composedChapters[i]?.body?.[0] }));
check(
  'the OLD index pairing mismatches (confirms the fixture reproduces it)',
  positional.filter(p => !p.body?.includes(`PROSE-FOR:${p.room} `)).length === WRITE_ROOMS.length,
  JSON.stringify(positional.slice(0, 3)),
);

console.log('\n3. "Living Room" vs "Formal Living Room" — the ambiguous pair');

// Titles that only CONTAIN the room name, forcing the contains pass to run.
const decorated = [
  { title: 'The Formal Living Room', body: ['PROSE-FOR:Formal Living Room x.', 'y.'] },
  { title: 'The Living Room', body: ['PROSE-FOR:Living Room x.', 'y.'] },
];
const amb = matchRoomsToChapters(['Living Room', 'Formal Living Room'], decorated).roomToChapter;
check(
  'Formal Living Room claims its own chapter',
  amb.get('Formal Living Room')?.body[0].includes('PROSE-FOR:Formal Living Room'),
  amb.get('Formal Living Room')?.body[0],
);
check(
  'Living Room is not given the Formal Living Room chapter',
  amb.get('Living Room')?.body[0].includes('PROSE-FOR:Living Room x'),
  amb.get('Living Room')?.body[0],
);

// Exact titles must win outright regardless of the order rooms are processed.
const exact = matchRoomsToChapters(
  ['Living Room', 'Formal Living Room'],
  [
    { title: 'Living Room', body: ['PROSE-FOR:Living Room x.', 'y.'] },
    { title: 'Formal Living Room', body: ['PROSE-FOR:Formal Living Room x.', 'y.'] },
  ],
).roomToChapter;
check(
  'exact titles bind exactly, both rooms correct',
  exact.get('Living Room')?.body[0].includes('PROSE-FOR:Living Room x') &&
    exact.get('Formal Living Room')?.body[0].includes('PROSE-FOR:Formal Living Room x'),
);

console.log('\n4. A chapter is never shared, and an unmatched room gets no one else\'s story');

const missing = matchRoomsToChapters(
  ['Kitchen', 'Powder Room'],
  [{ title: 'Kitchen', body: ['PROSE-FOR:Kitchen x.', 'y.'] }],
);
check(
  'the room with no chapter stays unmatched (→ demoted to photo-only)',
  !missing.roomToChapter.has('Powder Room'),
  JSON.stringify(missing.roomToChapter.get('Powder Room')),
);
check(
  'it is NOT handed the leftover Kitchen chapter',
  missing.roomToChapter.get('Kitchen')?.body[0].includes('PROSE-FOR:Kitchen') &&
    missing.roomToChapter.size === 1,
);

const dup = matchRoomsToChapters(
  ['Entry', 'Stairway'],
  [
    { title: 'Entry', body: ['PROSE-FOR:Entry x.', 'y.'] },
    { title: 'Entry', body: ['PROSE-FOR:Entry duplicate.', 'y.'] },
  ],
);
check(
  'two rooms never share one chapter (Stairway unmatched, not aliased to Entry)',
  !dup.roomToChapter.has('Stairway'),
);

console.log('\n5. Normalization tolerates the shapes room names actually take');

for (const [roomName, title] of [
  ['living_room', 'Living Room'],
  ['DINING_ROOM', 'Dining Room'],
  ['Primary Bathroom', 'Primary Bathroom — A Study in Stone'],
  ['Entry', 'The Entry'],
] as const) {
  const m = matchRoomsToChapters([roomName], [{ title, body: ['PROSE-FOR:x.', 'y.'] }]).roomToChapter;
  check(`"${roomName}" matches a chapter titled "${title}"`, m.has(roomName));
}

check(
  'a room name does not match inside a longer word ("entry" vs "entryway")',
  !matchRoomsToChapters(['Entry'], [{ title: 'Entryway Closet', body: ['x.', 'y.'] }]).roomToChapter.has('Entry'),
);

console.log(
  failures === 0
    ? '\nAll editorial room-matching checks passed.\n'
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
