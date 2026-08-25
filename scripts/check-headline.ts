/**
 * Guards the headline contract: 4-10 words, sentence case, nothing generic.
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
check(`${HEADLINE_MAX_WORDS} words is allowed`,
  !codes('One two three four five six seven eight nine ten').includes('TOO_LONG'));
check(`${HEADLINE_MAX_WORDS + 1} words is not`,
  codes('One two three four five six seven eight nine ten eleven').includes('TOO_LONG'));
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

console.log('\n7. A headline never spends its one line on a name');
// "A house Matto never had to redraw" — shipped, and the byline directly under
// it already said Diano Matto. On an org-credited project it is worse than
// redundant: it contradicts the credit.
const NAMES = { designerName: 'Diano Matto', orgName: 'BP Design' };
const nameCodes = (t: string) => headlineIssues(t, NAMES).map(i => i.code);
check('the surname alone is caught',
  nameCodes('A house Matto never had to redraw').includes('NAMES_PEOPLE'));
check('the full name is caught',
  nameCodes('How Diano Matto kept the cracked slab').includes('NAMES_PEOPLE'));
check('the studio name is caught',
  nameCodes('BP Design goes dark in Miami').includes('NAMES_PEOPLE'));
check('a headline about the house is not',
  !nameCodes('No walls moved, every room changed anyway').includes('NAMES_PEOPLE'));
check('and neither is one naming a place',
  !nameCodes('The stone chose the rest of the house').includes('NAMES_PEOPLE'));
// Only enforceable because the caller says who is credited — "Matto" is a
// designer's name on this project and an ordinary word somewhere else.
check('with no names supplied, nothing is flagged',
  !headlineIssues('A house Matto never had to redraw').map(i => i.code).includes('NAMES_PEOPLE'));
check('the batch endpoint passes the credited names to the filter',
  /headlineIssues\(text, names\)/.test(readFileSync('src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts', 'utf8')));
check('the full generator applies the same rule',
  /designerName: input\.designer\?\.name/.test(readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8')));

console.log('\n8. Cycling reaches every option, not two of them');
// The pool was rebuilt as [current, ...others] on every render, so the live
// headline sat at index 0 forever: the counter always read "1 of 6" and "next"
// was always the headline just left. Six candidates, two reachable.
const pickerSrc = readFileSync('src/components/story/HeadlinePicker.tsx', 'utf8');
check('the pool is the stored list, not a list reordered around the current one',
  /alternatives\.includes\(current\) \? alternatives :/.test(pickerSrc));
check('the index is the real position of the current headline',
  /pool\.indexOf\(current\)/.test(pickerSrc) && !/\[current, \.\.\.alternatives\.filter/.test(pickerSrc));
check('the batch is stored WITH the headline it replaces, so current is a member',
  /const pool = currentKicker \? \[currentKicker, \.\.\.kept\] : kept/.test(
    readFileSync('src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts', 'utf8')));

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
check('the criteria state the 4-10 word bound', /4-10 words/.test(tone));
check('the criteria state sentence case with an explicit counter-example',
  /CAPITALIZATION: sentence case/.test(tone) && /never\s*\n"A Miami Beach House That/.test(tone));
check('the criteria ban the shape that shipped', /refuses to \[verb\]/.test(tone));
check('the criteria separate the headline\'s job from the deck\'s',
  /DIVIDE THE WORK WITH THE DECK/.test(tone));
check('the criteria forbid naming the designer, studio or client',
  /NEVER NAME THE DESIGNER, THE STUDIO, OR THE CLIENT/.test(tone));
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
// "Rate these 1-10" returns a spread of sevens and changes nothing.
check('it is asked for a decision, not a score',
  /KILL a headline for any of these three reasons/.test(editor)
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
check('an all-cut batch says the options were generic, not that they were malformed',
  /editorCut > 0/.test(headlineRoute));

// Stored pools outlive the rules that produced them. This is why a banned
// headline kept being offered after the ban shipped.
const tiles = readFileSync('src/lib/story/buildRoomTiles.ts', 'utf8');
check('stored alternatives are re-graded on read, not trusted from write time',
  /headlineIssues\(t, headlineNames\)\.length === 0/.test(tiles));
check('...and against the byline names too, so a stale batch cannot name the designer',
  /designerName: designer\?\.name/.test(tiles));

console.log('\n10. Editing the headline cannot be silently swallowed');
// `lead.title` is never persisted today, but readers still resolve
// `lead.title || lead.kicker`. On any row carrying one, writing only `kicker`
// would leave the stale title winning at render.
const override = readFileSync('src/app/api/posting/project/[projectId]/sections/override/route.ts', 'utf8');
check('saving the headline also updates a legacy lead.title',
  /field === 'kicker' && typeof blocks\.lead\.title === 'string'/.test(override));
check('and the recorded original is read from the same place',
  /return blocks\.lead\?\.kicker \?\? blocks\.lead\?\.title \?\? ''/.test(override));

console.log(failures === 0
  ? '\nAll headline checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
