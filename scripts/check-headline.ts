/**
 * Guards the headline contract: 4-16 words, sentence case, nothing generic.
 *
 * The failure this exists for shipped as:
 *   "A Miami Beach house that refuses to pick one mood and wear it all the way
 *    through"
 * — 17 words against a stated 8-15, in a shape ("refuses to…") that describes a
 * project by what it declines to do, from a prompt whose entire headline
 * specification was one parenthetical. Nothing checked the word count, and
 * nothing said anything about capitalization at all.
 *
 * Note what is asserted and what is NOT: normalizeHeadline must never restyle
 * the case of any word but the first. Lowercasing a Title Case headline cannot
 * distinguish "House" from "Miami Beach", and "Miami beach" on a published page
 * is worse than the Title Case it replaced. Drift is reported instead.
 *
 * Run: npm run check:headline
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import {
  normalizeHeadline,
  blockingIssues,
  headlineIssues,
  looksTitleCased,
  HEADLINE_MAX_WORDS,
} from '../src/lib/posting/headline';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};
const codes = (s: string) => headlineIssues(s).map(i => i.code);

const SHIPPED = 'A Miami Beach house that refuses to pick one mood and wear it all the way through';

console.log('\n1. The headline that prompted this is caught, on both counts');
check('the 17-word headline is flagged as too long',
  codes(SHIPPED).includes('TOO_LONG'), JSON.stringify(headlineIssues(SHIPPED)));
check('the "refuses to…" shape is flagged',
  codes(SHIPPED).includes('BANNED_SHAPE'));
check('a conforming replacement passes clean',
  headlineIssues('A Miami Beach house that changes mood room by room').length === 0,
  JSON.stringify(headlineIssues('A Miami Beach house that changes mood room by room')));

console.log('\n2. Length is enforced as a real bound, not a suggestion');
// Generated from the constant, so raising the cap cannot leave a stale literal
// asserting the old bound — which is exactly what happened when B8 moved it.
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
check(`${HEADLINE_MAX_WORDS} words is allowed`,
  !codes(words(HEADLINE_MAX_WORDS)).includes('TOO_LONG'));
check(`${HEADLINE_MAX_WORDS + 1} words is not`,
  codes(words(HEADLINE_MAX_WORDS + 1)).includes('TOO_LONG'));
// The cap is a backstop, not a shaping constraint. B8 raised it from 10 to 16 on
// corpus evidence: 35% of real published headlines exceeded 10, and the collected
// corpus runs to 16. A frame decides the shape; this only catches a runaway.
check('the cap is 16, and documented as a backstop rather than a target',
  HEADLINE_MAX_WORDS === 16
  && /BACKSTOP, not a shaping constraint/.test(
    readFileSync('src/lib/posting/headline.ts', 'utf8').replace(/\s*\n\/\/\s*/g, ' ')));
// The 17-word headline that prompted this whole module is STILL caught.
check('the original 17-word failure is still too long',
  codes(SHIPPED).includes('TOO_LONG'));
check('three words is too short', codes('The stone chose').includes('TOO_SHORT'));
check('four words is fine', !codes('Every room argues here').includes('TOO_SHORT'));

console.log('\n3. Sentence case is detected, never forced');
check('a Title Case headline is flagged',
  looksTitleCased('A Miami Beach House That Changes Mood Room By Room'));
check('sentence case with a place name is NOT flagged',
  !looksTitleCased('A Miami Beach house that changes mood room by room'));
check('sentence case with a designer name is NOT flagged',
  !looksTitleCased('How Diano Matto kept the cracked slab'));
// Known limitation, asserted so it stays known: a headline that really is mostly
// proper nouns trips the heuristic. It costs a log line, which is why this only
// ever warns.
check('a proper-noun-heavy headline is a documented false positive, not a gate',
  looksTitleCased("Inside Diano Matto's Miami Beach house")
  && /heuristic, not a gate/.test(readFileSync('src/lib/posting/headline.ts', 'utf8')));
// The property that protects live articles.
const titleCased = 'A Miami Beach House That Changes Mood';
check('normalizeHeadline does NOT lowercase anything — "Miami beach" can never ship',
  normalizeHeadline(titleCased) === titleCased, normalizeHeadline(titleCased));
check('...and the source says so, so nobody "fixes" it later',
  /LOWERCASING is not/.test(readFileSync('src/lib/posting/headline.ts', 'utf8')));

console.log('\n4. The safe cleanups are applied');
check('a wrapping quote pair is stripped',
  normalizeHeadline('“Every room argues its own case”') === 'Every room argues its own case');
check('a terminal period is stripped',
  normalizeHeadline('Every room argues its own case.') === 'Every room argues its own case');
check('a question mark is kept — that is a choice, not an accident',
  normalizeHeadline('Who said a bathroom has to whisper?').endsWith('?'));
check('the first character is capitalized',
  normalizeHeadline('every room argues its own case') === 'Every room argues its own case');
check('interior capitals are untouched by the first-char fix',
  normalizeHeadline('miami Beach, room by room') === 'Miami Beach, room by room');
check('whitespace is collapsed',
  normalizeHeadline('  Every   room  argues '.toString()) === 'Every room argues');
check('empty stays empty rather than throwing', normalizeHeadline('') === '');

console.log('\n5. The generic shapes are refused');
for (const [headline, why] of [
  ['A house that refuses to sit still', 'refuses to'],
  ['A kitchen that isn\'t afraid to shout', "isn't afraid to"],
  ['Where warmth meets restraint', 'Where X meets Y'],
  ['A study in quiet contrast', 'A study in X'],
  ['Redefining the Miami beach house', 'Redefining X'],
  ['The art of layering texture', 'The art of X-ing'],
  ['A timeless sanctuary above the bay', 'brochure vocabulary'],
] as const) {
  check(`refused: ${why}`, codes(headline).includes('BANNED_SHAPE'), headline);
}
check('a concrete headline is not caught by the shape filter',
  !codes('The kitchen that started with a cracked slab').includes('BANNED_SHAPE'));
check('a specific headline naming a place is not caught',
  !codes('Two crews, one site, the same afternoon').includes('BANNED_SHAPE'));

console.log('\n6. A caption is not a headline');
// Reported: "these are facts that are being recruited as titles. this is
// supposed to be editorial." Every one is specific, accurate, about the real
// house — and every one says what a photograph shows and then stops. Nothing is
// at issue, nothing was decided, nobody could disagree.
//
// The previous criteria CAUSED this. "Write about something a reader can see —
// a material, a room, a fixture" is an instruction to inventory, and one of the
// GOOD examples ("Dark in one wing, bright in the other") was itself the
// balanced-pair caption shape, teaching it directly.
const REPORTED_CAPTIONS: Array<[string, string]> = [
  ['A stairway reconciles two different moods', 'personified architecture'],
  ['A moody entry gives way to a sunlit landing', 'walkthrough transition'],
  ['One house, written in different chapters', 'about the article, not the house'],
  ['Bold in the kitchen, soft in the primary bedroom', 'balanced pair'],
  ['The exterior stays quiet so the rooms can argue', 'personified architecture'],
  ['Finishes and fixtures do all the talking', 'personified architecture / cliché'],
];
for (const [headline, why] of REPORTED_CAPTIONS) {
  check(`refused (${why})`, codes(headline).includes('BANNED_SHAPE'), headline);
}

// EVERY example the criteria print under NEVER THE BALANCED PAIR, not just the
// one the rule was first written around.
//
// The original regex spelled out a single lexicalization — "<word> in the <word>,
// <word> in the <word>" — so of the three headlines the prose lists as the
// canonical balanced pair it caught exactly one. The other two passed clean, and
// "Formal outside, unruly within, and both are true on purpose" shipped to a
// designer. A rule the checker implements one third of is not a rule.
//
// The structural property is a quality pinned to a PLACE, twice. Keying on the
// locator rather than on the adjective is what lets "Two crews, one site, the
// same afternoon" — also a comma list of verbless fragments, and a GOOD example —
// stay alive below.
for (const headline of [
  'Bold in the kitchen, soft in the primary bedroom',
  'Dark in one wing, bright in the other',
  'Moody here, sunlit there',
  'Formal outside, unruly within, and both are true on purpose',
  'Quiet upstairs, loud downstairs',
  'Dark in the study, bright in the hall',
]) {
  check(`balanced pair refused: "${headline}"`,
    codes(headline).includes('BANNED_SHAPE'), JSON.stringify(headlineIssues(headline)));
}
// The locator is what makes it a floor plan. Without one, a comma list is just a
// list, and some of those are the best headlines the criteria have.
for (const headline of [
  'Two crews, one site, the same afternoon',
  'They bought the marble in Italy, then redrew the plan',
  'The slab cracked, and they kept it',
]) {
  check(`comma list with no locator survives: "${headline}"`,
    !codes(headline).includes('BANNED_SHAPE'), JSON.stringify(headlineIssues(headline)));
}

// The filter must not have widened so far that headlines with an event in them
// die alongside the captions. Each of these names something that HAPPENED.
for (const good of [
  'The kitchen that started with a cracked slab',
  'Two crews, one site, the same afternoon',
  'The stone chose the rest of the house',
  'They bought the marble before the plan',
  'The slab arrived cracked and stayed',
  'The clients asked for one dark room',
]) {
  check(`still allowed: "${good}"`, headlineIssues(good).length === 0,
    JSON.stringify(headlineIssues(good)));
}
// "The stone chose the rest of the house" is personification too — and it is
// GOOD, because choosing is a decision. The ban targets architecture performing
// a MOOD (arguing, whispering, staying quiet), not architecture causing an
// outcome. If that line ever starts failing, the rule has gone too wide.
check('personification that encodes a decision survives the conceit ban',
  headlineIssues('The stone chose the rest of the house').length === 0);

console.log('\n7. The naming ban is gone — B8, on corpus evidence');
// It banned the credited designer or studio from the headline, enforced as
// NAMES_PEOPLE at write and again on read. 57% of published design headlines open
// on exactly that name, so the ban was killing the corpus's best-supported
// arrangement for a reason the corpus does not share: "the byline below already
// says it".
//
// These assertions are the reversal, kept so nobody reinstates the rule by reflex.
const NAMED = 'How Diano Matto kept the cracked slab';
check('a headline may now name the designer',
  headlineIssues(NAMED).length === 0, JSON.stringify(headlineIssues(NAMED)));
check('...and the studio',
  headlineIssues('BP Design goes dark in Miami').length === 0);
// The comment explaining the removal still names it, deliberately. What must be
// gone is the CODE: the issue code and the push that emitted it.
check('the NAMES_PEOPLE issue code no longer exists',
  !/'NAMES_PEOPLE'/.test(readFileSync('src/lib/posting/headline.ts', 'utf8')));
check('headlineIssues takes no names argument',
  /export function headlineIssues\(text: string\): HeadlineIssue\[\]/.test(
    readFileSync('src/lib/posting/headline.ts', 'utf8')));
check('the criteria no longer forbid naming',
  !/NEVER NAME THE DESIGNER/.test(readFileSync('src/lib/interview/prompts/editorialTone.ts', 'utf8')));
check('the read path no longer re-grades against names',
  !/headlineNames/.test(readFileSync('src/lib/story/buildRoomTiles.ts', 'utf8')));
check('the reversal is explained where the rule lived',
  /NAMES_PEOPLE is gone/.test(readFileSync('src/lib/posting/headline.ts', 'utf8')));
// What did NOT change. docs/20 gates PRODUCT and BRAND names out of prose until the
// exposure is paid for — a commercial rule about a placement Folio sells. A
// designer's own credit was never that, and unbanning it does not touch the gate.
check('the product naming gate is untouched',
  /product naming gate/i.test(readFileSync('src/lib/posting/headline.ts', 'utf8'))
  && /resolveProductNaming/.test(readFileSync('src/lib/naming/applyProseNamingGate.ts', 'utf8')));

console.log('\n8. Cycling reaches every option, not two of them');
// The pool was rebuilt as [current, ...others] on every render, so the live
// headline sat at index 0 forever: the counter always read "1 of 6" and "next"
// was always the headline just left. Six candidates, two reachable.
const pickerSrc = readFileSync('src/components/story/HeadlinePicker.tsx', 'utf8');
check('the pool is the stored list, not a list reordered around the current one',
  /alternatives\.includes\(current\) \? alternatives :/.test(pickerSrc));
check('the index is the real position of the current headline',
  /pool\.indexOf\(current\)/.test(pickerSrc) && !/\[current, \.\.\.alternatives\.filter/.test(pickerSrc));
// C2 narrowed this. The live headline is still carried into the pool — the picker
// needs it there to be walkable — but it is GATED first. It used to be prepended
// unconditionally, which meant a headline written before a rule existed re-entered
// the pool on every press because it was the one currently showing. That is how a
// passive headline outlived the check that bans it. Dropping it does not strand the
// designer: HeadlinePicker splices the live headline back when the stored pool does
// not contain it, so it stays reachable while live and stops being an OPTION after.
const regenSrc = readFileSync('src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts', 'utf8');
check('the batch is stored WITH the headline it replaces, so current is a member',
  /const pool = carriedKicker \? \[carriedKicker, \.\.\.kept\] : kept/.test(regenSrc));
check('...but the carried headline is gated, not trusted for having been live',
  /blockingIssues\(currentKicker\)\.length === 0/.test(regenSrc)
  && /!hasWeakPredicate\(currentKicker\)/.test(regenSrc));

console.log('\n9. The prompt and the checker state the same rules');
const draft = readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');
const headlineRoute = readFileSync('src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts', 'utf8');
// The criteria live in editorialTone.ts so the generator and the regenerate
// endpoint grade a headline by the same rules. Two copies would mean a
// regenerated headline is judged against something other than the one it
// replaces — which is precisely what makes a regenerate button feel random.
const tone = readFileSync('src/lib/interview/prompts/editorialTone.ts', 'utf8');
check('the criteria are a real spec, not a parenthetical',
  /HEADLINE \(the "kicker"\)/.test(tone));
check('the criteria state the 4-16 word bound', /4-16 words/.test(tone));
check('the criteria state sentence case with an explicit counter-example',
  /CAPITALIZATION: sentence case/.test(tone) && /never\s*\n"A Miami Beach House That/.test(tone));
check('the criteria ban the shape that shipped', /refuses to \[verb\]/.test(tone));
check('the criteria separate the headline\'s job from the deck\'s',
  /DIVIDE THE WORK WITH THE DECK/.test(tone));
check('the criteria no longer forbid naming — reversed in B8',
  !/NEVER NAME THE DESIGNER/.test(tone));
check('the criteria refuse headlines built on an absence',
  /DO NOT DEFINE THE PROJECT BY WHAT DID NOT HAPPEN/.test(tone));
check('the criteria give the caption test',
  /A HEADLINE IS NOT A CAPTION/.test(tone)
  && /could this sentence sit under a\s*\nphotograph/.test(tone));
check('the criteria require something at stake',
  /SOMETHING HAS TO BE AT STAKE/.test(tone));
check('the criteria refuse the balanced pair',
  /NEVER THE BALANCED PAIR/.test(tone));
// The instruction that produced the inventory headlines is gone, along with the
// GOOD example that was itself a balanced pair.
check('the "name a thing a reader can see" instruction is gone',
  !/WRITE ABOUT SOMETHING A READER CAN SEE/.test(tone));
check('the balanced-pair example is no longer taught as good',
  !/Dark in one wing, bright in the other"\n/.test(tone));
check('every GOOD example is annotated with what is at stake in it',
  /\(a mistake they kept\)/.test(tone) && /\(a claim, arguable\)/.test(tone));
check('the old 8-15 word instruction is gone', !/8-15 words/.test(draft) && !/8-15 words/.test(tone));
check('the generator references the shared criteria instead of copying them',
  /\$\{HEADLINE_CRITERIA\}/.test(draft) && !/HEADLINE \(the "kicker"\)/.test(draft));
check('there is exactly one copy of the criteria in the app', (() => {
  const hits = execSync(
    'grep -rl \'HEADLINE (the "kicker")\' --include=*.ts src/ || true',
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean);
  return hits.length === 1 && hits[0].includes('editorialTone.ts');
})());
check('every generated headline is normalized before it is stored',
  /kicker: composedKicker/.test(draft) && /normalizeHeadline\(/.test(draft));
check('drift is logged rather than silently rewritten',
  /headline departs from house style/.test(draft));

console.log('\n9b. Judgement, not just pattern matching');
// The mechanical check can only reject a shape someone already watched fail.
// Banning "so the rooms can argue" produced "the kitchen stone dictated every
// finish around it" and "a bright room asked for black anchors, not brass" —
// same failure, verbs that were not on the list yet. The list always loses that
// race, so the batch is now read by an editor before the designer sees it.
const editor = readFileSync('src/lib/posting/headlineEditor.ts', 'utf8');
check('the editor judges, and can only cut and reorder — never rewrite',
  /Your job is to CUT, not to write/.test(editor)
  && !/normalizeHeadline/.test(editor));
check('it cuts what a regex cannot see: interchangeable, unsupported, no stakes',
  /1\. INTERCHANGEABLE/.test(editor)
  && /2\. UNSUPPORTED/.test(editor)
  && /3\. NOTHING AT STAKE/.test(editor));
// The first live batch. Every headline the designer rejected was a VERDICT on
// the finished house rather than a report of anything that happened in it, and
// three of the four reached for a contrast to say so. A contrast has the cadence
// of a claim, which is exactly why criterion 3 did not fire on any of them — so
// the counterfeit has to be named, not left to be inferred from "no stakes".
check('it also cuts the verdict — a summary of what the house is LIKE',
  /4\. VERDICT INSTEAD OF REPORT/.test(editor));
check('...and names the contrast as a counterfeit stake, which is why 3 missed these',
  /COUNTERFEITS a stake/.test(editor));
check('...and the headline that comments on its own cleverness',
  /on its own cleverness/.test(editor) && /both are true on purpose/.test(editor));
check('the criteria are stated as four, so the count cannot drift from the list',
  /KILL a headline for any of these four reasons/.test(editor)
  && /survive all four/.test(editor));
// A model that must name the answer a headline came from cannot keep one that
// came from nowhere without writing the lie down.
check('a keeper must name the interview moment it reports',
  /"on": "<for a keeper only/.test(editor)
  && /name the moment in the interview it came from/.test(editor));
check('...but a missing one is not treated as a failed verdict',
  /on\?: string;/.test(editor)
  && /\.on === 'string' \? \(entry as any\)\.on : undefined/.test(editor));
// "Rate these 1-10" returns a spread of sevens and changes nothing.
check('it is asked for a decision, not a score',
  /KILL a headline for any of these four reasons/.test(editor)
  && !/\b(rate|score|rank them 1|1-10|out of 10)\b/i.test(editor.split('const EDITOR_SYSTEM')[1].split('`;')[0]));
check('it is given the interview to check the candidates against',
  /## The reporting/.test(editor) && /interview/.test(editor));
// A model grading its own twelve suggestions defends them.
check('it is a separate call, so it did not write what it is judging',
  /export async function judgeHeadlines/.test(editor)
  && /anthropic\.messages\.create/.test(editor));
// The two headlines that survived every rule are BOTH interchangeable — that is
// the criterion doing the work here, not a new banned verb.
check('the verbs that got through are NOT chased into the regex',
  !/dictated/.test(readFileSync('src/lib/posting/headline.ts', 'utf8'))
  && !/asked for/.test(readFileSync('src/lib/posting/headline.ts', 'utf8')));
// Same discipline, applied to the first live batch. Of the four headlines the
// designer rejected, ONE is a structural shape the criteria already ban, and the
// mechanical layer now catches it. The other three are editorial judgements:
//
//   "Glass won the dining table argument by disappearing"  — a conceit, but
//     "The stone chose the rest of the house" is a GOOD example and is the same
//     shape. Banning material-as-agent kills the good one too.
//   "A reserved facade for clients who never wanted flash" — interchangeable.
//   "Renovating finishes only, and still changing everything" — a verdict.
//
// Each is decidable only against the interview, which is the editor's input and
// not the regex's. If these ever start failing here, someone has widened the
// mechanical layer into territory it cannot judge, and "The stone chose the rest
// of the house" is about to die with them.
for (const editorial of [
  'Glass won the dining table argument by disappearing',
  'A reserved facade for clients who never wanted flash',
  'Renovating finishes only, and still changing everything',
]) {
  check(`left to the editor, not the regex: "${editorial}"`,
    headlineIssues(editorial).length === 0, JSON.stringify(headlineIssues(editorial)));
}
// An editor who is unreachable must not take the feature down with them.
check('an unavailable editor falls back to the writer\'s order, not to nothing',
  /return null/.test(editor)
  && /keeping the writer/.test(editor));
check('a partial verdict list is discarded whole, so no candidate is cut by silence',
  /verdicts\.length !== candidates\.length/.test(editor));
check('the caller actually falls back rather than failing the request',
  /if \(verdicts\) \{/.test(headlineRoute) && /\} else \{/.test(headlineRoute)
  && /sort\(takeOrder\)/.test(headlineRoute));
check('the editor\'s ranking wins, but the pool still spans angles',
  /const bestPerAngle = keeps\.filter/.test(headlineRoute));
check('what the editor cut, and why, is logged',
  /editor cuts/.test(headlineRoute));
// The cuts alone cannot tell you whether the pass is working: a batch of fluent
// verdicts kept for good-sounding reasons logs identically to a grounded one.
check('what it KEPT, its angle, and what each keeper reports, is logged too',
  /editor keeps/.test(headlineRoute) && /on: v\.on/.test(headlineRoute));
// A degraded pass ships the writer's unjudged batch, which is a different
// product from the one the pipeline is meant to produce — and from the outside
// the only symptom is that the headlines are worse. Anyone diagnosing a bad
// batch has to be able to tell the two apart before they touch a prompt.
check('a batch that shipped without the editor says so loudly',
  /NO EDITOR — shipping the writer/.test(headlineRoute));
check('an all-cut batch says the options were generic, not that they were malformed',
  /editorCut > 0/.test(headlineRoute));

// Stored pools outlive the rules that produced them. This is why a banned
// headline kept being offered after the ban shipped.
const tiles = readFileSync('src/lib/story/buildRoomTiles.ts', 'utf8');
check('stored alternatives are re-graded on read, not trusted from write time',
  /blockingIssues\(t\)\.length === 0/.test(tiles));

console.log('\n10. Editing the headline cannot be silently swallowed');
// `lead.title` is never persisted today, but readers still resolve
// `lead.title || lead.kicker`. On any row carrying one, writing only `kicker`
// would leave the stale title winning at render.
const override = readFileSync('src/app/api/posting/project/[projectId]/sections/override/route.ts', 'utf8');
check('saving the headline also updates a legacy lead.title',
  /field === 'kicker' && typeof blocks\.lead\.title === 'string'/.test(override));
check('and the recorded original is read from the same place',
  /return blocks\.lead\?\.kicker \?\? blocks\.lead\?\.title \?\? ''/.test(override));

console.log('\n11. TITLE_CASE warns, it does not drop — B9');
// This module always documented TITLE_CASE as "a heuristic, not a gate" that
// "returns a warning rather than driving a rewrite or blocking generation". The
// regenerate route dropped any candidate with any issue, and the story read path
// filtered them out of the stored pool. The documentation and the behaviour
// disagreed and the behaviour won silently, over a house convention a designer can
// fix in the preview in two seconds.
const TITLED = 'A Remodel Turns a Dark and Choppy House in Melbourne Into a Bright Family Home';
check('a Title Case headline still REPORTS the issue',
  headlineIssues(TITLED).some(i => i.code === 'TITLE_CASE'));
check('...marked as a warning',
  headlineIssues(TITLED).find(i => i.code === 'TITLE_CASE')?.severity === 'warning');
check('...and is therefore NOT blocking',
  blockingIssues(TITLED).length === 0, JSON.stringify(blockingIssues(TITLED)));
// Everything else still drops.
for (const [text, code] of [
  ['A house that refuses to sit still', 'BANNED_SHAPE'],
  ['One two three', 'TOO_SHORT'],
  ['Every room argues its own case.', 'TERMINAL_PUNCT'],
] as const) {
  check(`${code} is still an error`,
    blockingIssues(text).some(i => i.code === code), text);
}
check('every issue carries a severity',
  headlineIssues(TITLED).every(i => i.severity === 'error' || i.severity === 'warning'));
// Both sites that DROP must use the blocking filter; the route also still logs the
// warning, so a flagged headline is visible rather than silently kept.
const route = readFileSync('src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts', 'utf8');
check('the write filter drops on blocking issues only',
  /const blocking = blockingIssues\(text\);/.test(route)
  && !/const issues = headlineIssues\(text\);\n      if \(issues\.length > 0\)/.test(route));
check('...and still surfaces the warning',
  /kept with warnings/.test(route));
check('the read path re-grades on blocking issues only',
  /blockingIssues\(t\)\.length === 0/.test(tiles));
check('the reason is written where the severity is decided',
  /documentation\s*\n\s*\*\s*and the behaviour disagreed/.test(
    readFileSync('src/lib/posting/headline.ts', 'utf8')));

console.log(failures === 0
  ? '\nAll headline checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
