/**
 * Guards the pull-quote contract: every quote is the designer's exact words.
 *
 * The failure this exists for: pull quotes were regex-mined out of the
 * GENERATED ARTICLE, so a paraphrase the model wrote while composing became a
 * "direct quote". The designer said "elements on tension"; the article set
 * "elements in tension" in display type under his name.
 *
 * Verbatim-to-the-article is not verbatim-to-the-person. These checks assert
 * the difference.
 *
 * Run: npm run check:pull-quotes
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import {
  extractQuoteCandidates,
  isVerbatimSpan,
  normalizeForVerbatimCheck,
} from '../src/lib/posting/quoteCandidates';
import { buildShufflePool } from '../src/lib/posting/selectPullQuotes';
import { formatRoomName } from '../src/lib/utils/formatRoomName';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

// The real answers behind the La Gorce draft.
const ANSWERS = [
  { section: 'Primary Bathroom', isFollowUp: true, answer:
    "We definitely didn't want a monochromatic interior like the ones that are so popular in Miami these days. We feel it will be more timeless to introduce these elements on tension, and for each room to be distinct in a large house so it serves its purpose." },
  { section: 'Kitchen', isFollowUp: false, answer:
    "With the windows up top, we wanted it to be a bright space, and that helps with the transition between rooms." },
  { section: 'Powder Room', isFollowUp: false, answer: "It's nice." },
];
const sources = (room: string) => ANSWERS.filter(a => a.section === room).map(a => a.answer);

console.log('\n1. The exact shipped defect is now caught');
check('what the designer actually said verifies',
  isVerbatimSpan('elements on tension', sources('Primary Bathroom')));
check('the one-word alteration that shipped is REJECTED',
  !isVerbatimSpan('elements in tension', sources('Primary Bathroom')));
check('a fully invented quote is rejected',
  !isVerbatimSpan('We wanted the house to sing with light', sources('Primary Bathroom')));

console.log('\n2. Candidates are verbatim by construction');
const bath = extractQuoteCandidates(ANSWERS as any, 'Primary Bathroom');
check('a quotable room yields candidates', bath.length > 0, String(bath.length));
check('EVERY candidate is a verbatim span of its own answer',
  bath.every(c => isVerbatimSpan(c.text, sources('Primary Bathroom'))));
check('every candidate is contiguous (present in one unbroken answer)',
  bath.every(c => sources('Primary Bathroom').some(src =>
    normalizeForVerbatimCheck(src).includes(normalizeForVerbatimCheck(c.text)))));
check('candidate ids are unique', new Set(bath.map(c => c.id)).size === bath.length);

console.log('\n3. Follow-ups lead, because they are prompted to be quotable');
const mixed = [
  { section: 'Kitchen', isFollowUp: false, answer: 'We used a lot of stone throughout the kitchen and it worked well.' },
  { section: 'Kitchen', isFollowUp: true, answer: 'The slab arrived cracked and we kept it, because the fracture told you it was real.' },
];
check('the follow-up answer is offered first',
  extractQuoteCandidates(mixed as any, 'Kitchen')[0]?.isFollowUp === true);

console.log('\n4. A thin room gets NO quote — never a borrowed one');
check('a thin answer yields zero candidates',
  extractQuoteCandidates(ANSWERS as any, 'Powder Room').length === 0);
check('no candidate leaks in from another room',
  extractQuoteCandidates(ANSWERS as any, 'Powder Room')
    .every(c => isVerbatimSpan(c.text, sources('Powder Room'))));
check('a room absent from the interview yields nothing',
  extractQuoteCandidates(ANSWERS as any, 'Wine Cellar').length === 0);

console.log('\n5. Normalization forgives rendering, not rewording');
check('curly apostrophes are tolerated',
  isVerbatimSpan('didn’t want a monochromatic interior', sources('Primary Bathroom')));
check('re-capitalising a trimmed quote is tolerated (typesetting, not rewording)',
  isVerbatimSpan("We feel it will be more timeless", sources('Primary Bathroom')));
check('collapsed whitespace is tolerated',
  isVerbatimSpan('We  definitely   didn\'t want', sources('Primary Bathroom')));
check('a changed word is NOT tolerated',
  !isVerbatimSpan("We definitely didn't want a monochrome interior", sources('Primary Bathroom')));
check('empty text never verifies', !isVerbatimSpan('', sources('Kitchen')));

console.log('\n6. The pipeline sources quotes from answers, not from prose');
const draft = readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');
check('pull quotes are assigned as the LAST step, after body rewrites',
  draft.indexOf('assignVerifiedPullQuotes(blocks') > draft.indexOf('applyProseNamingGate(blocks'),
);
check('assignment runs after the sentence-opener rewrite too',
  draft.indexOf('assignVerifiedPullQuotes(blocks') > draft.indexOf('fixSentenceOpeners(blocks'));
check('the lead hook quote is verified verbatim before it can ship',
  /isVerbatimSpan\(text, hookSources\)/.test(draft));

const ranker = readFileSync('src/lib/posting/selectPullQuotes.ts', 'utf8');
check('the ranking model is asked for ids, never text',
  /candidate id or null/.test(ranker) && !/"quote"\s*:/.test(ranker));
check('selection is re-verified against the source answer',
  /isVerbatimSpan\(chosen\.text, sources\)/.test(ranker));
check('an unusable pick falls back to a code-ranked candidate',
  /candidates\.find\(c => isVerbatimSpan\(c\.text, sources\)\)/.test(ranker));

const route = readFileSync('src/app/api/posting/project/[projectId]/interview/generate/route.ts', 'utf8');
check('regenerate preserves nothing (no chapter is frozen)',
  /const frozenChapters: any\[\] = \[\];/.test(route));

console.log('\n7. The shuffle set is usable by the editing UI');
// The editor finds its position with alternatives.findIndex(a => a.text === selected)
// and the PATCH endpoint rejects any selectedText not in alternatives. Both break
// if the chosen quote is omitted from the list.
const room = [
  { section: 'Kitchen', isFollowUp: false, answer:
    'We led with stone in the kitchen. The slab runs up the wall behind the range so the material reads as architecture.' },
  { section: 'Kitchen', isFollowUp: true, answer:
    'The slab arrived cracked and we kept it, because the fracture told you it was real. We did not want anything that looked manufactured.' },
];
const cands = extractQuoteCandidates(room as any, 'Kitchen');
const pick = cands[0];
const shuffle = buildShufflePool(pick, cands);

check('the chosen quote is IN the pool — the editor finds its index at 0',
  shuffle.findIndex(c => c.text === pick.text) === 0,
  `index ${shuffle.findIndex(c => c.text === pick.text)}`);
check('the pool offers several options to cycle through', shuffle.length > 1, String(shuffle.length));
check('every option is verbatim from the room\'s own answers',
  shuffle.every(c => isVerbatimSpan(c.text, room.map(a => a.answer))));
check('no option is a prefix-extension of another (no near-duplicate clicks)',
  shuffle.every((a, i) => shuffle.every((b, j) => {
    if (i === j) return true;
    const x = normalizeForVerbatimCheck(a.text), y = normalizeForVerbatimCheck(b.text);
    return !x.includes(y) && !y.includes(x);
  })));
check('the pool is capped', buildShufflePool(pick, cands, 2).length <= 2);
check('cycling forward through the whole pool returns to the pick', (() => {
  let idx = shuffle.findIndex(c => c.text === pick.text);
  for (let n = 0; n < shuffle.length; n++) idx = (idx + 1 + shuffle.length) % shuffle.length;
  return shuffle[idx].text === pick.text;
})());

// The picker moved to the story tree when editing was consolidated into the
// preview. It is the ONE implementation of this control — a second copy is a
// second chance to grow a free-text box where only selection belongs.
const picker = readFileSync('src/components/story/PullQuotePicker.tsx', 'utf8');
check('the editor still locates the current pick by text within alternatives',
  /alternatives\.findIndex\(a => a\.text === selectedText\)/.test(picker));
check('the picker only ever PATCHes text drawn from alternatives',
  /patch\(alternatives\[nextIndex\]\.text\)/.test(picker)
  && /patch\(alternatives\[0\]\.text\)/.test(picker));
check('there is exactly one pull-quote picker in the app', (() => {
  const hits = execSync(
    "grep -rl 'sections/pull-quote' --include=*.tsx src/ || true",
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean);
  return hits.length === 1 && hits[0].includes('PullQuotePicker.tsx');
})());
const patch = readFileSync('src/app/api/posting/project/[projectId]/sections/pull-quote/route.ts', 'utf8');
check('the endpoint only accepts a quote already in alternatives (so shuffling stays verbatim)',
  /alternatives\.find\(\(a: any\) => a\.text === selectedText\)/.test(patch));

console.log('\n8. No unverified quote can survive anywhere in the pipeline');
// The hole this closes: assembly used to seed a body-mined pull quote, and the
// verified pass SKIPPED any chapter it could not rank — so a room with photos
// and prose but no interview answers kept the unverified one.
check('assembly no longer seeds body-derived chapter pull quotes',
  !/pullQuote: extractPullQuotesForChapter\(bodyParas/.test(draft));
check('a chapter with no verified selection is CLEARED, not skipped',
  !/if \(selection === undefined\) continue/.test(draft)
  && /Cleared, not skipped/.test(draft));
check('the intro-mined hook quote is verified against real answers',
  /isVerbatimSpan\(introHook\.text, answerTexts\)/.test(draft));
// Execution order, not file order: the function is DEFINED above its call site,
// so comparing raw indexes proves nothing. Assert the rebuild lives inside the
// assigning function's own body, which is what actually sequences it.
const fnStart = draft.indexOf('async function assignVerifiedPullQuotes(');
const fnEnd = draft.indexOf('\n}\n', draft.indexOf('return blocks;', fnStart));
const fnBody = draft.slice(fnStart, fnEnd);
check('the top-level index is rebuilt inside the assigning pass, after the quotes are set',
  fnBody.includes('syncPullQuotesFromChapters')
  && fnBody.indexOf('syncPullQuotesFromChapters') > fnBody.indexOf('ch.pullQuote = selection'),
);

console.log('\n9. Room attribution survives the trip to the quote selector');
// The hole this closes: stored answers carry `roomId` (D5) and NEVER a room
// name — `section` on a stored answer is the question category ("what"/"how"),
// not a room. The generate route read only `a.roomName`, so every answer became
// section 'General', `byRoom` was keyed under the single room "General", no
// chapter title matched, and assignVerifiedPullQuotes CLEARED every chapter's
// pull quote. A fully answered project generated with zero pull quotes.
const genRoute = readFileSync('src/app/api/posting/project/[projectId]/interview/generate/route.ts', 'utf8');
check('the route resolves an answer\'s roomId to a room name',
  /roomId: a\?\.roomId \?\? a\?\.room_id \?\? null/.test(genRoute)
  && /roomName: answerRoom\(a\)/.test(genRoute));
check('follow-ups get their room resolved too', /roomName: answerRoom\(f\)/.test(genRoute));
// Chapter titles come from the IMAGE side and pull quotes are looked up by the
// ANSWER side. Two resolvers would let those drift; one closure cannot.
check('answers and gallery images share ONE room resolver',
  (genRoute.match(/buildRoomResolver\(projectRooms\)/g) ?? []).length === 1
  && /const answerRoom = \(a: any\)[\s\S]{0,200}resolveRoomName\(\{ roomId/.test(genRoute));
check('follow-ups carry roomId through the follow-up normalizer',
  /roomId: a\.roomId \?\? a\.room_id \?\? null,/.test(genRoute));
check('follow-ups stay marked as follow-ups (they are ranked first by design)',
  /isFollowUp: true,/.test(genRoute));

// Functional: the selector's keys must equal the chapter titles, or every
// lookup misses exactly as it did in production.
const roomAnswers = [
  { section: 'DINING_ROOM', isFollowUp: true, answer:
    'We always use glass when we need to make up space. Had we used a solid table we would have crowded it.' },
  { section: 'primary bathroom', isFollowUp: false, answer:
    'The clients loved this stone when we went shopping together, and it quickly became the one.' },
];
check('a room key from an answer equals the chapter title built from the same room',
  formatRoomName('DINING_ROOM') === 'Dining Room' && formatRoomName('dining_room') === 'Dining Room');
check('candidates are found under the room name, not under General',
  extractQuoteCandidates(roomAnswers as any, 'DINING_ROOM').length > 0
  && extractQuoteCandidates(roomAnswers as any, 'General').length === 0);
check('every room with a real answer yields at least one candidate',
  roomAnswers.every(a => extractQuoteCandidates(roomAnswers as any, a.section!).length > 0));

console.log(failures === 0
  ? '\nAll pull-quote checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
