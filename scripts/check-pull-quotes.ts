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
import { buildShufflePool, toSelection, selectPullQuotes } from '../src/lib/posting/selectPullQuotes';
import { scoreStandalone } from '../src/lib/posting/quoteStandalone';
import { verifyPullQuoteProvenance, verifyQuoteAgainstAnswers }
  from '../src/lib/posting/verifyQuoteProvenance';
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
  /candidate id/.test(ranker) && !/"quote"\s*:/.test(ranker));
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
  /pq\.alternatives\.find\(line => line\.text === body\.selectedText\)/.test(patch));

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

// ─── 14. The room and the question category stop sharing one field ───────────
//
// loadInterviewAnswers overwrites `section` with the resolved ROOM, because
// quoteCandidates.ts:98 and selectPullQuotes.ts:173 match it against a chapter
// title. That overwrite is correct and must stay. What it used to destroy was
// the question CATEGORY the stores hold under the same name — a "what" question
// asked about the Entry arrived as Entry with its topic gone and no way back.
//
// Both halves are asserted here because they are one property: the room reaches
// the consumers AND the category survives alongside it. Asserting either alone
// would pass while the other regressed.
console.log('\n14. The room reaches the consumers and the category survives beside it');

async function loaderChecks() {
  // The loader talks to the database, so the database is what gets stubbed —
  // the loader itself is the real one, which is the only way this assertion
  // means anything. Installed before the dynamic import for the same
  // module-evaluation-order reason the fetch stub is imported first.
  const Module = await import('module');
  const origLoad = (Module.default as any)._load;
  const ROOMS = [{ id: 'room-entry', name: 'Entry' }, { id: 'room-kitchen', name: 'Kitchen' }];
  const PAYLOAD = [
    // A "what" question asked about a room: the exact shape that used to lose
    // its category. Room and topic must BOTH survive.
    { questionId: 'ctx-01', section: 'what', answer:
      'We use paneling strategically in our projects and throughout the house. It gives the eye somewhere to rest.',
      roomId: 'room-entry', isFollowUp: false },
    { questionId: 'how-01', section: 'how', answer:
      'With the windows up top, we wanted it to be a bright space, and that helps with the transition between rooms.',
      roomId: 'room-kitchen', isFollowUp: false },
    // A payload whose `section` is not a real SECTION_ENUM member — what an
    // earlier derivation left behind. Must arrive null, never promoted to fact.
    { questionId: 'junk-01', section: 'notACategory', answer:
      'The stair rail took four tries before it felt like it belonged to the house.',
      roomId: 'room-entry', isFollowUp: true },
  ];
  (Module.default as any)._load = function (request: string) {
    if (request === '@/lib/prisma' || request.endsWith('/lib/prisma')) {
      return { prisma: { spotlightQuestion: { findMany: async () => [{ id: "durable-private" }] },
        projectPost: { findUnique: async () => ({ provenance: { interview: { payload: { answers: [...PAYLOAD, { questionId: 'durable-private', answer: 'PRIVATE_SPOTLIGHT_SENTINEL', questionSource: 'base_question' }], followups: [] } } } }) },
        room: { findMany: async () => ROOMS },
        editorialInterview: { findUnique: async () => ({ answers: [
          // The projection path. Its category lives in its own column rather than
          // under `section`, so it needs its own coverage — a fixture that only
          // exercises provenance passes while the column is being dropped.
          { id: 'row-1', questionId: 'flow-01', questionText: 'Tell us about the entry.',
            answerText: 'The entry had to do two jobs at once. It is the first thing you see and where everyone drops a coat.',
            isFollowUp: false, roomId: 'room-entry', parentAnswerId: null, questionCategory: 'where' },
        ] }) },
      } };
    }
    return origLoad.apply(this, arguments as any);
  };

  let loaded: any[];
  try {
    const { loadInterviewAnswers } = await import('../src/lib/posting/loadInterviewAnswers');
    loaded = await loadInterviewAnswers('check-project');
  } finally {
    (Module.default as any)._load = origLoad;
  }

  check('durable draft identity excludes a spoofed ordinary source label', !JSON.stringify(loaded).includes('PRIVATE_SPOTLIGHT_SENTINEL'));

  // ── the room half ──────────────────────────────────────────────────────────
  // Asserted as a set rather than a fixed sequence, so adding a fixture answer
  // does not make this fail for a reason that has nothing to do with the rule.
  check('the loader still resolves `section` to the room name',
    Array.from(new Set(loaded.map(a => a.section))).sort().join(',') === 'Entry,Kitchen',
    JSON.stringify(loaded.map(a => a.section)));
  check('the two consumers still find candidates under the room name',
    extractQuoteCandidates(loaded as any, 'Entry').length > 0
    && extractQuoteCandidates(loaded as any, 'Kitchen').length > 0);
  check('a question category is never mistaken for a room key',
    extractQuoteCandidates(loaded as any, 'what').length === 0
    && extractQuoteCandidates(loaded as any, 'how').length === 0);

  // ── the category half ──────────────────────────────────────────────────────
  const byText = (frag: string) => loaded.find(a => a.answer.includes(frag));
  check('a room answer keeps the category it was asked under',
    byText('paneling')?.questionCategory === 'what', JSON.stringify(byText('paneling')));
  check('...alongside the room, not instead of it',
    byText('paneling')?.section === 'Entry');
  check('a second answer keeps its own distinct category',
    byText('windows up top')?.questionCategory === 'how');
  check('a section that is not a real category arrives null, not promoted',
    byText('stair rail')?.questionCategory === null, JSON.stringify(byText('stair rail')));
  check('every loaded answer carries the field, even when unknown',
    loaded.every(a => 'questionCategory' in a));
  check('the category stored on the projection column reaches the loader too',
    byText('two jobs at once')?.questionCategory === 'where',
    JSON.stringify(byText('two jobs at once')));
  check('...with its own room, resolved the same way',
    byText('two jobs at once')?.section === 'Entry');
}

// ─── 15. The reverse sync stops overwriting the category with a guess ────────
//
// syncEditorialAnswersToProvenance writes projected answers back into
// provenance. It used to set `section` to deriveSection(questionId, questionText)
// unconditionally, and that function answers 'how' for every questionId this
// codebase mints — so a project completed through InterviewFlow came back with
// its whole interview relabelled 'how', corrupting the store the new column
// depends on. The stored category must win; the derivation survives only for
// rows that predate the column.
console.log('\n15. The reverse sync preserves a stored category');

async function reverseSyncChecks() {
  const Module = await import('module');
  const origLoad = (Module.default as any)._load;
  const ROWS = [
    // Stored category present: must be preserved verbatim, not re-derived.
    { questionId: 'clx0001', questionText: 'Why the paneling?', answerText: 'It gives the eye somewhere to rest.',
      isFollowUp: false, questionCategory: 'what', linkedImageId: null, linkedProductId: null,
      questionSource: null, aiClassificationAttribute: null },
    // No stored category (a row written before the column): derivation is the
    // last resort, and 'how' here is the honest legacy behaviour, not a regression.
    { questionId: 'clx0002', questionText: 'And the stair?', answerText: 'It took four tries before it belonged.',
      isFollowUp: false, questionCategory: null, linkedImageId: null, linkedProductId: null,
      questionSource: null, aiClassificationAttribute: null },
  ];
  (Module.default as any)._load = function (request: string) {
    if (request === '@/lib/prisma' || request.endsWith('/lib/prisma')) {
      return { prisma: { spotlightQuestion: { findMany: async () => [{ id: "durable-private" }] },
        editorialInterview: { findUnique: async () => ({ answers: ROWS }) },
        project: { findUnique: async () => ({ images: [], title: 'P' }) },
        projectPost: { findUnique: async () => ({ provenance: {} }), update: async () => ({}), create: async () => ({ provenance: {} }) },
      } };
    }
    return origLoad.apply(this, arguments as any);
  };

  let result: any;
  try {
    const mod = await import('../src/lib/editorial/syncEditorialAnswersToProvenance');
    result = await mod.syncEditorialAnswersToProvenance('check-project');
  } finally {
    (Module.default as any)._load = origLoad;
  }

  const bySpan = (frag: string) => result.answers.find((a: any) => a.answer.includes(frag));
  check('a stored category survives the trip back into provenance',
    bySpan('eye somewhere to rest')?.section === 'what',
    JSON.stringify(bySpan('eye somewhere to rest')));
  check('it is NOT overwritten with the derivation',
    bySpan('eye somewhere to rest')?.section !== 'how');
  check('a row with no stored category still falls back rather than dropping the field',
    typeof bySpan('four tries')?.section === 'string' && bySpan('four tries')?.section.length > 0);
}

// ─── 16. The projection WRITES the category, not just reads it ───────────────
//
// Section 14 hands the loader a projection row that already has the column set,
// which proves the read but says nothing about the write. rebuildAnswerProjection
// deletes every row and recreates it on each pass, so a field it fails to write
// is a field that vanishes on the next interview save. This asserts the payload
// handed to `create`.
console.log('\n16. The projection writes the category through delete-and-recreate');

async function projectionWriteChecks() {
  const Module = await import('module');
  const origLoad = (Module.default as any)._load;
  const created: any[] = [];
  const PAYLOAD = [
    { questionId: 'q-what', section: 'what', prompt: 'Why the paneling?', answer: 'It gives the eye somewhere to rest.', isFollowUp: false },
    { questionId: 'q-junk', section: 'notACategory', prompt: 'And the stair?', answer: 'It took four tries before it belonged.', isFollowUp: false },
  ];
  (Module.default as any)._load = function (request: string) {
    if (request === '@/lib/prisma' || request.endsWith('/lib/prisma')) {
      return { prisma: { spotlightQuestion: { findMany: async () => [{ id: "durable-private" }] },
        editorialInterview: { findUnique: async () => ({ id: 'i1', projectId: 'p1' }), create: async () => ({ id: 'i1' }) },
        projectPost: { findUnique: async () => ({ provenance: { interview: { payload: { answers: PAYLOAD, followups: [] } } } }) },
        editorialInterviewAnswer: {
          findMany: async () => [],
          deleteMany: () => ({ __op: 'deleteMany' }),
          create: (args: any) => { created.push(args.data); return { __op: 'create' }; },
        },
        $transaction: async (ops: any[]) => ops,
      } };
    }
    return origLoad.apply(this, arguments as any);
  };

  try {
    const mod = await import('../src/lib/editorial/syncInterviewAnswers');
    await mod.syncAnswersToEditorialInterview('p1');
  } finally {
    (Module.default as any)._load = origLoad;
  }

  const row = (qid: string) => created.find((r) => r.questionId === qid);
  check('the projection was exercised at all (guards the two checks below)', created.length === 2,
    `${created.length} row(s) created`);
  check('a real category is written to the column',
    row('q-what')?.questionCategory === 'what', JSON.stringify(row('q-what')?.questionCategory));
  check('a section that is not a real category is written as null, not as itself',
    row('q-junk')?.questionCategory === null, JSON.stringify(row('q-junk')?.questionCategory));
}

// ─── 19. Provenance: the durable pointer survives to the stored selection ────
//
// `isVerbatimSpan` proves a string existed in the answers AT SELECTION TIME and
// records nothing, so a quote verified at generation cannot be re-checked later.
// (questionId, isFollowUp) is the pointer that closes that loop — the row key
// rebuildAnswerProjection already treats as an answer's identity, and the only
// one that survives a sync, since row ids are re-minted and `answerIndex`
// indexes an array that does not outlive the run.
//
// Four properties, each the thing that would silently break:
//   a) it survives toSelection at all;
//   b) it survives a projection REBUILD — the pointer must still resolve after
//      every row has been deleted and recreated with new ids;
//   c) it is on every ALTERNATIVE, not just the selected quote, because the
//      picker publishes whichever one the designer cycles to;
//   d) a null-provenance row reports UNVERIFIABLE, not failed.
console.log('\n19. Provenance pointer');

function provenanceChecks() {
  const ROOM = 'Dining Room';
  const answers = [
    { section: ROOM, questionId: 'q-table', isFollowUp: false,
      answer: 'The table was the first thing we settled. It set the height of everything else in the room.' },
    { section: ROOM, questionId: 'q-glass', isFollowUp: true,
      answer: 'We always use glass when we need to make up space. Had we used a solid table we would have crowded it badly.' },
  ];

  const ranked = extractQuoteCandidates(answers, ROOM);
  check('candidates carry the question id they were cut from',
    ranked.length > 0 && ranked.every(c => typeof c.questionId === 'string' && c.questionId.length > 0),
    ranked.map(c => `${c.id}=${c.questionId}`).join(' '));
  check('a candidate points at the answer it actually came from',
    ranked.every(c => answers.some(a =>
      a.questionId === c.questionId && a.isFollowUp === c.isFollowUp && a.answer.includes(c.text))),
    'each candidate text is a span of its pointed-to answer');

  // (a) + (c) through the real toSelection, via the real selector's fallback
  // path: no model, so it takes the top code-ranked candidate.
  // The REAL toSelection, not a rebuild of it — so dropping the pointer there
  // turns these red instead of leaving a passing copy behind.
  const selection = toSelection(ranked[0], ranked);
  check('the stored selection carries a provenance pointer',
    !!selection.selected?.provenance?.questionId,
    JSON.stringify(selection.selected?.provenance));
  check('EVERY alternative carries its own pointer, not just the selected quote',
    selection.alternatives.length > 0 && selection.alternatives.every(a => !!a.provenance?.questionId),
    selection.alternatives.map(a => a.provenance?.questionId ?? 'MISSING').join(', '));
  check('each alternative points at the answer that alternative came from',
    selection.alternatives.every(alt => answers.some(a =>
      a.questionId === alt.provenance?.questionId &&
      a.isFollowUp === alt.provenance?.isFollowUp &&
      a.answer.includes(alt.text))));

  // (b) The pointer survives a projection rebuild. Row ids are re-minted, so a
  // stored row id would dangle here; the row key does not.
  const afterRebuild = answers.map((a, i) => ({ ...a, id: `regenerated-uuid-${i}-${Math.random()}` }));
  const verdicts = verifyPullQuoteProvenance(selection, afterRebuild).map(c => c.verdict);
  check('every pointer still resolves after a projection rebuild re-mints row ids',
    verdicts.length > 0 && verdicts.every(v => v === 'verified'),
    verdicts.join(', '));

  // (d) Pre-provenance rows: absent pointer is unverifiable, never failed.
  const legacy = {
    selected: { text: 'The table was the first thing we settled.' },
    alternatives: [{ text: 'We always use glass when we need to make up space.', score: 1 }],
  } as any;
  const legacyVerdicts = verifyPullQuoteProvenance(legacy, answers).map(c => c.verdict);
  check('a null-provenance quote reports unverifiable, not failed',
    legacyVerdicts.length === 2 && legacyVerdicts.every(v => v === 'unverifiable'),
    legacyVerdicts.join(', '));

  // The alarm still has to fire. A pointer at an answer that no longer contains
  // the text is a mismatch — that is the case this whole mechanism exists for.
  const drifted = verifyQuoteAgainstAnswers(
    'a sentence nobody said', { questionId: 'q-table', isFollowUp: false }, answers, 'selected');
  check('a quote that is not a span of its pointed-to answer reports mismatch',
    drifted.verdict === 'mismatch', drifted.verdict);
  const orphan = verifyQuoteAgainstAnswers(
    'The table was the first thing we settled.', { questionId: 'q-deleted', isFollowUp: false }, answers, 'selected');
  check('a pointer at an answer that no longer exists reports answer-missing',
    orphan.verdict === 'answer-missing', orphan.verdict);

  // Verification is against ONE answer, never joined text. A span spliced across
  // two answers must not pass just because both are in the interview.
  const spliced = verifyQuoteAgainstAnswers(
    'It set the height of everything else in the room. We always use glass',
    { questionId: 'q-table', isFollowUp: false }, answers, 'selected');
  check('a span crossing two answers fails — the check never joins them',
    spliced.verdict === 'mismatch', spliced.verdict);

  // Duplicates for one row key make "the" answer undefined. Reported, never
  // resolved by picking one.
  const dupes = [...answers, { section: ROOM, questionId: 'q-table', isFollowUp: false, answer: 'A different answer entirely.' }];
  const amb = verifyQuoteAgainstAnswers(
    'The table was the first thing we settled.', { questionId: 'q-table', isFollowUp: false }, dupes, 'selected');
  check('two answers sharing a row key report ambiguous rather than guessing',
    amb.verdict === 'ambiguous', amb.verdict);

  // The collaboration path has no durable key (section 19 note / item 6), so its
  // candidates must carry a null pointer rather than a fabricated one.
  const collab = extractQuoteCandidates(
    [{ section: 'VENDOR', isFollowUp: true, answer: 'We had to rebuild the whole run of cabinetry twice over.' }],
    'VENDOR');
  check('an answer with no question id yields a null pointer, never an invented one',
    collab.length > 0 && collab.every(c => c.questionId === null),
    collab.map(c => String(c.questionId)).join(', '));
}

// ─── 18. Re-answering UPDATES the row, it does not insert a second one ───────
//
// A designer answering the same question again is correcting themselves. Two
// rows for one row key (interviewId, questionId, isFollowUp) would give a pull
// quote's provenance pointer an ambiguous target, and after
// 20260904193000_add_row_key_unique is applied a second insert is a P2002 that
// reaches the designer as a 500 with their answer unsaved.
//
// Asserted against the WRITE THE MODULE ISSUES, not against a call sequence: a
// stub records every operation, and the assertions are about what reached the
// database. Any implementation that updates in place passes.
console.log('\n18. Re-answer updates rather than inserting');

async function reAnswerChecks() {
  const Module = await import('module');
  const origLoad = (Module.default as any)._load;
  const ops: Array<{ op: string; args: any }> = [];
  // One row already stored for this key, carrying context this route does not
  // know: the question was classified a follow-up, and the projection has since
  // attached a room, a category and audio to it.
  let stored: any = {
    id: 'row-1', interviewId: 'iv1', questionId: 'q-what', isFollowUp: false,
    answerText: 'The mauve came first.', questionText: 'What drove the palette?',
    inputModality: 'voice', questionSource: 'follow_up',
    roomId: 'room-dining', questionCategory: 'what',
    audioUrl: 'https://x/a.mp3', wordTimings: [{ word: 'The', start: 0, end: 0.2 }],
  };

  (Module.default as any)._load = function (request: string) {
    if (request === '@/lib/prisma' || request.endsWith('/lib/prisma')) {
      return { prisma: { spotlightQuestion: { findMany: async () => [{ id: "durable-private" }] }, editorialInterviewAnswer: {
        findFirst: async () => (stored ? { ...stored } : null),
        update: async (args: any) => { ops.push({ op: 'update', args }); stored = { ...stored, ...args.data }; return stored; },
        create: async (args: any) => { ops.push({ op: 'create', args }); stored = { ...args.data }; return stored; },
      } } };
    }
    return origLoad.apply(this, arguments as any);
  };

  let outcome: string;
  try {
    const mod = await import('../src/lib/interview/saveInterviewAnswer');
    // The second submission: different text, arriving by keyboard, and WITHOUT
    // a questionText — exactly the shape that used to overwrite a real stored
    // question with the route's generic fallback.
    outcome = await mod.saveInterviewAnswer({
      interviewId: 'iv1', questionId: 'q-what', questionText: undefined,
      answer: 'Actually the brass came first.', inputMode: 'text',
    });
  } finally {
    (Module.default as any)._load = origLoad;
  }

  check('a re-answer reports that it updated', outcome === 'updated', outcome);
  check('a re-answer issues no INSERT',
    ops.filter(o => o.op === 'create').length === 0,
    ops.map(o => o.op).join(', '));
  check('a re-answer issues exactly one UPDATE',
    ops.filter(o => o.op === 'update').length === 1,
    ops.map(o => o.op).join(', '));

  const data = ops.find(o => o.op === 'update')?.args?.data ?? {};
  check('the correction is what gets written',
    data.answerText === 'Actually the brass came first.', JSON.stringify(data.answerText));
  check('the modality is refreshed with the answer', data.inputModality === 'text', JSON.stringify(data.inputModality));

  // The preserve half. These are absent from the update payload, which is how
  // they survive — naming a column at all is what would null it.
  for (const col of ['questionText', 'questionSource', 'roomId', 'questionCategory', 'createdAt', 'id', 'interviewId']) {
    check(`a re-answer does not write ${col}`, !(col in data), `${col}=${JSON.stringify((data as any)[col])}`);
  }
  check('the stored question survives a submission that carried none',
    stored.questionText === 'What drove the palette?', JSON.stringify(stored.questionText));
  check('a question classified follow_up is not relabelled base_question',
    stored.questionSource === 'follow_up', JSON.stringify(stored.questionSource));
  check('the room and category the projection attached survive',
    stored.roomId === 'room-dining' && stored.questionCategory === 'what',
    `${stored.roomId} / ${stored.questionCategory}`);

  // Word timings are offsets into the answer they were transcribed from. Against
  // replaced text they resolve a quote to the wrong span, so they go.
  check('audio is cleared when the answer text changed',
    data.audioUrl === null && data.wordTimings !== undefined,
    `audioUrl=${JSON.stringify(data.audioUrl)} wordTimings=${JSON.stringify(data.wordTimings)}`);

  // And the first answer for a key must still insert.
  stored = null;
  ops.length = 0;
  (Module.default as any)._load = function (request: string) {
    if (request === '@/lib/prisma' || request.endsWith('/lib/prisma')) {
      return { prisma: { spotlightQuestion: { findMany: async () => [{ id: "durable-private" }] }, editorialInterviewAnswer: {
        findFirst: async () => null,
        update: async (args: any) => { ops.push({ op: 'update', args }); return {}; },
        create: async (args: any) => { ops.push({ op: 'create', args }); return args.data; },
      } } };
    }
    return origLoad.apply(this, arguments as any);
  };
  let firstOutcome: string;
  try {
    const mod = await import('../src/lib/interview/saveInterviewAnswer');
    firstOutcome = await mod.saveInterviewAnswer({
      interviewId: 'iv1', questionId: 'q-new', questionText: 'And the stair?',
      answer: 'It took four tries before it belonged.', inputMode: 'text',
    });
  } finally {
    (Module.default as any)._load = origLoad;
  }
  check('a first answer still inserts',
    firstOutcome === 'created' && ops.length === 1 && ops[0].op === 'create',
    `${firstOutcome}: ${ops.map(o => o.op).join(', ')}`);
}

// ─── 17. Self-sufficiency is a RANKING input, and only a ranking input ───────
//
// In published mode the reader sees the room photograph and the quote; the body
// is behind a click. A quote whose referent lives in that hidden body does not
// read. So candidates that survive the collapse must be offered first — to the
// designer cycling the picker and to the ranking model alike.
//
// The three things that could go wrong, and are asserted here:
//   a) the ordering does not actually change (the input is wired but inert);
//   b) it turns into a FILTER — a room loses candidates, which would silently
//      recreate the fallback-pool problem the no-fallback rule exists to stop;
//   c) it outranks nothing, or outranks the wrong thing.
//
// Asserted as an INVARIANT over the emitted order, not as a call sequence: any
// implementation that puts standalone spans first passes.
console.log('\n17. Self-sufficiency ranking');

function standaloneRankingChecks() {
  // Two answers for one room. The first sentence of each is standalone; the
  // second of the primary answer opens with a bare "It" and cannot be read
  // beside a photograph alone.
  const ROOM = 'Dining Room';
  const answers = [
    { section: ROOM, isFollowUp: false, answer:
      'The table was the first thing we settled. It remains agreeable, but still on theme for the rest of the house for sure.' },
    { section: ROOM, isFollowUp: true, answer:
      'We always use glass when we need to make up space. Had we used a solid table we would have crowded it badly.' },
  ];

  const ranked = extractQuoteCandidates(answers, ROOM);
  const verdicts = ranked.map(c => scoreStandalone(c.text).verdict);

  check('the fixture produces a pool worth ranking (guards every check below)',
    ranked.length >= 3 && verdicts.includes('not-standalone') && verdicts.includes('standalone'),
    `${ranked.length} candidate(s), verdicts: ${verdicts.join(', ')}`);

  // (a) + (c) The invariant: no non-standalone span may precede a standalone one.
  const firstBad = verdicts.indexOf('not-standalone');
  const lastGood = verdicts.lastIndexOf('standalone');
  check('every standalone candidate is offered before every non-standalone one',
    firstBad === -1 || lastGood < firstBad,
    `order: ${verdicts.join(', ')}`);

  // (c) Specifically: it outranks the follow-up tier. A follow-up that does not
  // read on its own is still a follow-up that does not read on its own.
  const followUpBroken = [
    { section: ROOM, isFollowUp: true, answer: 'It was the one thing the budget never reached in the end.' },
    { section: ROOM, isFollowUp: false, answer: 'The plaster ceiling is what the whole room is organised around.' },
  ];
  const mixed = extractQuoteCandidates(followUpBroken, ROOM);
  check('self-sufficiency outranks the follow-up tier',
    mixed.length >= 2 && scoreStandalone(mixed[0].text).verdict === 'standalone' && !mixed[0].isFollowUp,
    mixed.map(c => `${c.isFollowUp ? 'FU' : 'P '} ${scoreStandalone(c.text).verdict} "${c.text}"`).join(' | '));

  // (b) Ranking, never filtering. Same multiset in, same multiset out.
  const unranked = new Set(ranked.map(c => c.text));
  check('ranking drops nothing — a room with no standalone candidate still offers its pool',
    unranked.size === ranked.length && ranked.length === new Set(ranked.map(c => c.id)).size,
    `${ranked.length} candidates, ${unranked.size} distinct texts`);

  const allBroken = [
    { section: ROOM, isFollowUp: false, answer:
      'It was the one room the budget never really reached. But we did what we could with the light in there.' },
  ];
  const broken = extractQuoteCandidates(allBroken, ROOM);
  check('a room where NOTHING is standalone still yields candidates (ranking, not filtering)',
    broken.length > 0 && broken.every(c => scoreStandalone(c.text).verdict !== 'standalone'),
    `${broken.length} candidate(s)`);

  // The verbatim guarantee is upstream of ranking and must survive it untouched.
  const srcs = answers.map(a => a.answer);
  check('every ranked candidate is still a verbatim span of its room answers',
    ranked.every(c => isVerbatimSpan(c.text, srcs)));

  // The contract with the model: numbered candidates, model returns an id. Ids
  // are assigned at extraction and must still resolve after the sort.
  check('every candidate still carries an id the ranker can return',
    ranked.every(c => typeof c.id === 'string' && c.id.length > 0));
}

// Sequential, not Promise.all: loaderChecks and reverseSyncChecks each install a
// module-loader stub and restore it in a finally, so running them concurrently
// lets one restore the loader out from under the other. Found by doing it.
async function automaticRoomSelectionChecks() {
  const sixAnswers = [
    'We always use glass when we need to make up space.',
    'The black pendants balance the brightness of the dining room.',
    'The rounded lights repeat the shapes found across the house.',
    'The wallpaper gives the dining room a character of its own.',
    'We kept the original structure and changed the finishes in every room.',
    'The dining chairs bring the dark accents down to the table.',
  ].map((answer, index) => ({ section: 'Kitchen', answer, questionId: `q${index}`, isFollowUp: false }));
  for (const reply of ['{"Kitchen":null}', '{}', '{"Kitchen":"q999"}']) {
    setRankerReply(reply);
    const result = await selectPullQuotes(['Kitchen', 'Powder Room'], [...sixAnswers, ANSWERS[2]], 'auto-selection-check', null, true);
    const quote = result.byRoom.Kitchen;
    check(`generation automatically selects verified room quote for ${reply}`,
      !!quote?.selected && isVerbatimSpan(quote.selected.text, sixAnswers.map(answer => answer.answer)));
    check('automatic selection retains review alternatives',
      quote?.alternatives.length === 6 && quote.alternatives.some(option => option.text === quote.selected?.text));
    check('room without candidates remains empty', result.byRoom['Powder Room'] === null);
  }
}

automaticRoomSelectionChecks()
  .then(collaborationChecks)
  .then(loaderChecks)
  .then(reverseSyncChecks)
  .then(projectionWriteChecks)
  .then(standaloneRankingChecks)
  .then(reAnswerChecks)
  .then(provenanceChecks)
  .then(() => {
  console.log(failures === 0
    ? '\nAll pull-quote checks passed.\n'
    : `\n${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
});
