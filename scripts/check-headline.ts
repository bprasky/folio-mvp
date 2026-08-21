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

console.log('\n6. The prompt and the checker state the same rules');
const draft = readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');
check('the prompt carries a real headline spec, not a parenthetical',
  /HEADLINE \(the "kicker"\)/.test(draft));
check('the prompt states the 4-10 word bound', /4-10 words/.test(draft));
check('the prompt states sentence case with an explicit counter-example',
  /CAPITALIZATION: sentence case/.test(draft) && /never\s*\n"A Miami Beach House That/.test(draft));
check('the prompt bans the shape that shipped', /refuses to \[verb\]/.test(draft));
check('the prompt separates the headline\'s job from the deck\'s',
  /DIVIDE THE WORK WITH THE DECK/.test(draft));
check('the old 8-15 word instruction is gone', !/8-15 words/.test(draft));
check('every generated headline is normalized before it is stored',
  /kicker: composedKicker/.test(draft) && /normalizeHeadline\(/.test(draft));
check('drift is logged rather than silently rewritten',
  /headline departs from house style/.test(draft));

console.log('\n7. Editing the headline cannot be silently swallowed');
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
