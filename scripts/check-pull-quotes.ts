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
// FIRST import, deliberately: it stubs the Messages API and sets the API key
// before any module that constructs an Anthropic client is evaluated. See the
// module header for why ordering is load-bearing here.
import { setRankerReply, calls, lastRankerPrompt } from './stub-anthropic-fetch';

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import {
  extractQuoteCandidates,
  isVerbatimSpan,
  normalizeForVerbatimCheck,
} from '../src/lib/posting/quoteCandidates';
import { buildShufflePool } from '../src/lib/posting/selectPullQuotes';
import { formatRoomName } from '../src/lib/utils/formatRoomName';
import { extractQuotes } from '../src/lib/instagram/extractQuotes';
import { extractQuotesWithMetadata, matchQuotesToImages } from '../src/lib/instagram/matchQuoteToImage';

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

// ─── 10. Instagram export quotes are the article's, not the article's prose ───
//
// The export is the one surface that leaves the platform. A sentence set over a
// photograph there cannot be corrected after the fact, and the audience has no
// way to check it. Both extractors used to fall through to `lead.deck` and to
// any 50–150 character sentence sliced out of a chapter body — model-written
// article prose, published as somebody's speech.
//
// Asserted as a property of the OUTPUT, not of the implementation: whatever
// these functions do internally, every string they return must be one of the
// article's verified selections. A fixture that carries prose and a deck
// alongside the selections is the whole test — an implementation that mines
// either one fails it, however it is written.
console.log('\n10. Instagram export sources only verified selections');

const VERIFIED_A = 'The mauve went in first and everything else had to answer to it.';
const VERIFIED_B = 'We definitely didn’t want a monochromatic interior, even though that is what everyone asks for.';
const DECK = 'A Hudson Valley renovation where the palette was settled before the plan was.';
const PROSE = 'The brass hardware reads warm against the mauve, an unlacquered finish chosen so it would darken.';

const exportBlocks: any = {
  lead: { kicker: 'A kitchen that stopped apologising', deck: DECK },
  hookQuote: { text: VERIFIED_B, context: 'Diano Matto' },
  galleryChapters: [
    {
      title: 'Kitchen',
      imageIds: ['img-kitchen-1'],
      body: [PROSE, `${PROSE} It reads as a decision rather than a default, which is the point.`],
      pullQuote: {
        selected: { text: VERIFIED_A, context: 'Diano Matto' },
        alternatives: [{ text: VERIFIED_A, score: 1 }],
      },
    },
    // A room with prose but no verified selection: the case that used to produce
    // an invented overlay and must now produce nothing.
    { title: 'Primary Bathroom', imageIds: ['img-bath-1'], body: [PROSE], pullQuote: null },
  ],
  pullQuotes: [
    { text: VERIFIED_B, context: 'Diano Matto' },
    { text: VERIFIED_A, context: 'Diano Matto', sourceSection: 'Kitchen' },
  ],
};

const VERIFIED_SET = new Set([VERIFIED_A, VERIFIED_B].map(normalizeForVerbatimCheck));
const fromVerified = (texts: string[]) =>
  texts.length > 0 && texts.every(t => VERIFIED_SET.has(normalizeForVerbatimCheck(t)));

const exported = extractQuotes(exportBlocks);
check('extractQuotes returns only the article’s verified selections',
  fromVerified(exported), JSON.stringify(exported));
check('extractQuotes does not mine chapter body prose',
  !exported.some(q => normalizeForVerbatimCheck(q).includes(normalizeForVerbatimCheck(PROSE).slice(0, 40))));
check('extractQuotes does not fall back to the editorial deck',
  !exported.some(q => normalizeForVerbatimCheck(q) === normalizeForVerbatimCheck(DECK)));

const withMeta = extractQuotesWithMetadata(exportBlocks);
check('extractQuotesWithMetadata returns only verified selections',
  fromVerified(withMeta.map(q => q.text)), JSON.stringify(withMeta.map(q => q.text)));
check('extractQuotesWithMetadata does not mine chapter body prose',
  !withMeta.some(q => normalizeForVerbatimCheck(q.text).includes(normalizeForVerbatimCheck(PROSE).slice(0, 40))));

// No verified selection anywhere: the export must come back empty so the caller
// omits the overlay. A non-empty result here means something is being generated.
const bareBlocks: any = {
  lead: { deck: DECK },
  galleryChapters: [{ title: 'Kitchen', imageIds: ['img-kitchen-1'], body: [PROSE], pullQuote: null }],
};
check('an article with no verified selection exports no quotes',
  extractQuotes(bareBlocks).length === 0 && extractQuotesWithMetadata(bareBlocks).length === 0,
  `${JSON.stringify(extractQuotes(bareBlocks))} / ${JSON.stringify(extractQuotesWithMetadata(bareBlocks))}`);

// And the overlay is genuinely absent rather than defaulted: a slide whose room
// has no selection gets no text, which is what makes it render as the photograph.
const bareMatches = matchQuotesToImages(extractQuotesWithMetadata(bareBlocks) as any, [
  { id: 'img-kitchen-1', url: 'https://example.test/k1.jpg', room: 'Kitchen' },
] as any);
check('with nothing verified, no image is given an overlay', bareMatches.size === 0);

// ─── 11. The collaboration narrative does not author quotes ───────────────────
//
// The prompt, asserted as a property of the prompt text rather than of any line
// in it: it must forbid quoting, must carry the grounding guardrail docs/17 §5
// requires of every prose generator, and must contain no phrase that licenses
// quoting. "Find the emotional core" is listed because it was there; the other
// entries are the shapes the same license takes when reworded.
console.log('\n11. Collaboration narrative prompt forbids quoting');

const collab = readFileSync('src/lib/collaboration/narrative/assembleStory.ts', 'utf8');
const promptText = (collab.match(/`[^`]*`/g) ?? [])
  .filter(lit => /Writing guidelines|Craft a compelling narrative/.test(lit))
  .join('\n');
check('the narrative prompts were found (guards the two checks below)', promptText.length > 200);
check('the prompt forbids quoting either party',
  /never quote either party/i.test(promptText));
check('the prompt carries the shared grounding guardrail',
  /\$\{EDITORIAL_ACCURACY_RULES\}/.test(promptText));
for (const licence of [
  'find the emotional core',
  'use direct quotes',
  'include direct quotes',
  'weave quotes',
  'let both voices shine',
]) {
  check(`the prompt does not license quoting: "${licence}"`,
    !new RegExp(licence, 'i').test(promptText));
}

// ─── 12. The collaboration ranker returns IDs, and only IDs reach the page ────
//
// The same guarantee the article has, asserted the same way: drive the ranker
// with replies a misbehaving model could actually produce, and require that the
// text which survives is always a verbatim span of the answers of the
// contributor it is attributed to. Nothing here asserts a call order — it
// asserts that no reply shape can put a sentence on the page that its named
// speaker did not say.
console.log('\n12. Collaboration quotes are selected, never authored');

const say = (questionId: string, answer: string) => ({ questionId, answer, answeredAt: '2026-01-01T00:00:00Z' });
const VENDOR_LINE = 'She sends a plan with the fixture already drawn in at the right scale. Nobody does that.';
const DESIGNER_LINE = 'The client wanted it lacquered so it would stay bright and I wanted it to go dark the way brass is supposed to.';
const COLLAB_DATA: any = {
  vendorOrgName: 'ACME Lighting Co.',
  designerName: 'Diano Matto',
  vendorRound1: { questions: [], responses: [say('v1', 'We met at a trade show in 2019 and she asked about lead times before anything else.')] },
  vendorRound2: { questions: [], responses: [say('v2', `${VENDOR_LINE} It means we are checking her math instead of guessing at it.`)] },
  vendorRound3: { questions: [], responses: [say('v3', 'Reading what she said about the brass, I did not know she had argued with the client about it.')] },
  designerRound1: { questions: [], responses: [say('d1', 'I called them because a rep actually answered the phone on a Friday afternoon.')] },
  designerRound2: { questions: [], responses: [say('d2', `We went round and round on the brass. ${DESIGNER_LINE}`)] },
  designerRound3: { questions: [], responses: [say('d3', 'He is right that we never told them about the argument. There was no reason to.')] },
};

const vendorAnswers = ['vendorRound1', 'vendorRound2', 'vendorRound3']
  .flatMap((k) => COLLAB_DATA[k].responses.map((r: any) => r.answer));
const designerAnswers = ['designerRound1', 'designerRound2', 'designerRound3']
  .flatMap((k) => COLLAB_DATA[k].responses.map((r: any) => r.answer));
const answersFor = (role: string) => (role === 'Vendor' ? vendorAnswers : designerAnswers);
const answersForOther = (role: string) => (role === 'Vendor' ? designerAnswers : vendorAnswers);

async function collaborationChecks() {
  const { selectCollaborationQuotes, narrativeToBlocks } =
    await import('../src/lib/collaboration/narrative/assembleStory');

  const run = async (reply: string) => {
    setRankerReply(reply);
    return selectCollaborationQuotes(COLLAB_DATA);
  };

  // Every reply shape, one invariant: whatever comes back is that speaker's words.
  const replies: Array<[string, string]> = [
    ['a valid id', '{"Vendor": "q5", "Designer": "q6"}'],
    ['an id that does not exist', '{"Vendor": "q99", "Designer": "q6"}'],
    ['prose in place of an id', `{"Vendor": ${JSON.stringify('The brass was always going to go dark.')}, "Designer": null}`],
    ['another contributor’s sentence as the id', `{"Vendor": ${JSON.stringify(DESIGNER_LINE)}, "Designer": null}`],
    ['a malformed response', 'not json at all'],
    ['an empty object', '{}'],
  ];

  // Guard against a vacuous pass. If the ranking call silently failed, every
  // assertion below would still pass via the offline code-ranking fallback while
  // testing nothing about the model's reply. Prove the model was consulted, and
  // prove what it was consulted WITH: numbered candidates carrying the
  // contributor's own sentences, which is the half of "IDs only" that lives in
  // the request rather than the response.
  await run('{"Vendor": "q5", "Designer": "q6"}');
  check('the collaboration ranker is actually consulted', calls.ranker > 0);
  check('the ranker is sent numbered candidates, grouped by contributor',
    /^## (Vendor|Designer)$/m.test(lastRankerPrompt) && /^q\d+\. \S/m.test(lastRankerPrompt),
    lastRankerPrompt.slice(0, 200));
  check('the candidates the ranker sees are the contributors\u2019 own sentences',
    lastRankerPrompt.includes(VENDOR_LINE) && lastRankerPrompt.includes(DESIGNER_LINE));

  for (const [label, reply] of replies) {
    const quotes = await run(reply);
    const allVerbatim = quotes.every(q => isVerbatimSpan(q.text, answersFor(q.role)));
    const noCrossAttribution = quotes.every(q => !isVerbatimSpan(q.text, answersForOther(q.role)));
    check(`ranker returns ${label} — every emitted quote is its speaker’s own words`,
      allVerbatim, JSON.stringify(quotes.map(q => `${q.role}: ${q.text}`)));
    check(`ranker returns ${label} — nothing is attributed across contributors`,
      noCrossAttribution);
  }

  // The specific failure this replaces: text supplied by the model reaching the
  // page. It must not appear even when the model puts it where an id belongs.
  setRankerReply(`{"Vendor": ${JSON.stringify('The brass was always going to go dark.')}, "Designer": null}`);
  const injected = await selectCollaborationQuotes(COLLAB_DATA);
  check('model-supplied text is never emitted as a quote',
    injected.every(q => q.text !== 'The brass was always going to go dark.'),
    JSON.stringify(injected));

  // Declining is a supported outcome and must produce nothing rather than a
  // generated stand-in.
  setRankerReply('{"Vendor": null, "Designer": null}');
  const declined = await selectCollaborationQuotes(COLLAB_DATA);
  check('a ranker that declines both yields no quote and no fallback',
    declined.length === 0, JSON.stringify(declined));

  // narrativeToBlocks must build quote blocks from the verified argument only.
  // A model reply carrying its own `quotes` array — the legacy shape, and what a
  // regressed prompt would produce again — must not reach the block stream.
  const narrativeWithSmuggledQuotes: any = {
    title: 'ACME Lighting Co. × Diano Matto',
    excerpt: 'x',
    sections: [{
      type: 'intro',
      content: 'The partnership began at a trade show.',
      quotes: [{ speaker: 'VENDOR', speakerName: 'ACME Lighting Co.', text: 'We knew straight away it would work.' }],
    }],
    suggestedTags: [],
    generatedAt: '2026-01-01T00:00:00Z',
  };
  const smuggled = narrativeToBlocks(narrativeWithSmuggledQuotes, []);
  check('a model reply carrying its own quotes array produces no quote block',
    smuggled.every((b: any) => b.type !== 'verbatimQuote' && b.type !== 'pullQuote')
    && !JSON.stringify(smuggled).includes('We knew straight away it would work.'),
    JSON.stringify(smuggled));

  // The verified argument is the only source of a quote block.
  const withVerified = narrativeToBlocks(narrativeWithSmuggledQuotes,
    [{ text: VENDOR_LINE, speaker: 'ACME Lighting Co.', role: 'Vendor' }]);
  const emitted = withVerified.filter((b: any) => b.type === 'verbatimQuote');
  check('quote blocks come from the verified argument',
    emitted.length === 1 && (emitted[0] as any).text === VENDOR_LINE);
}

// ─── 13. The legacy collaboration block tag stays dark ────────────────────────
//
// Stories generated before the rewiring still carry `pullQuote` blocks the model
// wrote. Nothing rewrote those rows, so the renderer is the only thing standing
// between them and a reader. The arm must return without reading the block's
// text — teaching it to draw again is how every one of them comes back at once.
console.log('\n13. Legacy collaboration pullQuote blocks do not render');

const storyView = readFileSync('src/components/collaboration/CollaborationStoryView.tsx', 'utf8');
const legacyArm = storyView.slice(
  storyView.indexOf("case 'pullQuote':"),
  storyView.indexOf("case '", storyView.indexOf("case 'pullQuote':") + 10),
);
check('the renderer has a pullQuote arm at all (guards the two checks below)',
  legacyArm.length > 0 && legacyArm.startsWith("case 'pullQuote':"));
check('the legacy pullQuote arm returns null', /return null;/.test(legacyArm));
check('the legacy pullQuote arm never reads the block’s text',
  !/block\.(text|speaker|role)/.test(legacyArm), legacyArm.slice(0, 200));

collaborationChecks().then(() => {
  console.log(failures === 0
    ? '\nAll pull-quote checks passed.\n'
    : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
});
