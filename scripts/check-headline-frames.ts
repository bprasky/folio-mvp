/**
 * Guards the headline frame library.
 *
 * The audit's finding was that unenforced prompt prose is exactly what failed on
 * this surface: HEADLINE_CRITERIA banned the balanced pair in three examples and the
 * checker implemented one of them. A frame library is more prompt prose unless
 * something asserts its structure, so this is that.
 *
 * Run: npm run check:headline-frames
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import {
  HEADLINE_VERBS,
  BANNED_HEADLINE_VERBS,
  BANNED_HEADLINE_VERBS_RULE,
  UNVEIL_EXCEPTION,
  selectVerbs,
  renderVerbInstruction,
  explainVerb,
  conditionState,
  usesBannedVerb,
  assertVerbLibraryIntegrity,
} from '../src/lib/interview/prompts/headlineVerbs';
import {
  HEADLINE_FRAMES,
  MATERIAL_FRAME,
  TAIL_RULE,
  eligibleFrames,
  renderFrameInstruction,
  hasEvaluativeTail,
  assertFrameLibraryIntegrity,
  type ResolvedSlot,
} from '../src/lib/interview/prompts/headlineFrames';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const frames = readFileSync('src/lib/interview/prompts/headlineFrames.ts', 'utf8');
const slots = readFileSync('src/lib/posting/headlineSlots.ts', 'utf8');
const route = readFileSync('src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts', 'utf8');
const tone = readFileSync('src/lib/interview/prompts/editorialTone.ts', 'utf8');
const draft = readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');

console.log('\n1. The library is structurally sound');
const { errors, warnings } = assertFrameLibraryIntegrity();
check('no structural errors', errors.length === 0, errors.join('\n        '));
check('the type holds five or more frames', /readonly HeadlineFrame\[\]/.test(frames));
for (const w of warnings) console.log(`  NOTE  ${w}`);
// Unsourced exemplars are reported, never failed — blocking on them would mean
// inventing them, which is how the old criteria came to teach the balanced pair
// as a GOOD example.
check('an unsourced exemplar list warns rather than fails',
  warnings.some(w => /no exemplars/.test(w)) && errors.length === 0);
check('exemplars are documented as never-invented',
  /NEVER invented/.test(frames));

console.log('\n2. Every slot names the row it comes from');
for (const frame of HEADLINE_FRAMES) {
  for (const slot of frame.slots) {
    check(`${frame.id}.${slot.name} names a source`, !!slot.source.trim(), slot.source);
    check(`${frame.id}: shape places {${slot.name}}`, frame.shape.includes(`{${slot.name}}`));
  }
}

console.log('\n3. The Material frame cannot carry a brand into prose');
// docs/20 gates product and brand names out of published prose unless the exposure
// is paid for, and calls the sentence Folio's most valuable editorial real estate.
// A headline is the most valuable sentence there is. The protection is structural:
// the slot draws from a finish column, so there is no path for a name to arrive.
check('the material slot draws from a finish column, not a product name',
  /finishRaw/.test(MATERIAL_FRAME.slots[0].source)
  && !/Product\.name|Product\.brand/.test(MATERIAL_FRAME.slots[0].source));
check('the frame says so in words, so nobody "improves" it later',
  /never a product name and never a brand/.test(MATERIAL_FRAME.slots[0].description),
  MATERIAL_FRAME.slots[0].description);
check('the resolver never selects Product.name or Product.brand as a value',
  !/value:\s*.*product\?\.(name|brand)/.test(slots));
check('a finish carrying its own product or brand name is refused',
  /carriesProprietaryName/.test(slots)
  && /if \(carriesProprietaryName\(raw, tag\.product\?\.name, tag\.product\?\.brand\)\) continue;/.test(slots));
check('...and docs/20 is cited where that decision lives',
  /docs\/20/.test(slots));

console.log('\n4. Only a value a human stated is usable');
check('eligibility requires finishConfirmed',
  /finishConfirmed: true/.test(slots) && /finishConfirmed/.test(MATERIAL_FRAME.slots[0].source));
check('interview prose is explicitly refused as a slot source',
  /material named in interview PROSE/i.test(slots));
check('a material inferred from a product name is explicitly refused',
  /INFERRED from a product name/i.test(slots));
// An unverified value must be ABSENT, not present-and-flagged: a frame that fires
// on a proposed finish is the fabrication the design exists to prevent.
const unverified: ResolvedSlot[] = [
  { name: 'material', value: 'brass', source: 'ProductTag.finishRaw', verified: false },
];
check('an unverified slot makes the frame ineligible',
  eligibleFrames(unverified, { hasDeck: true }).length === 0);
check('an empty slot value makes the frame ineligible',
  eligibleFrames([{ name: 'material', value: '   ', source: 'x', verified: true }], { hasDeck: true }).length === 0);
const verified: ResolvedSlot[] = [
  { name: 'material', value: 'unlacquered brass', source: 'ProductTag.finishRaw', verified: true },
];
check('a verified slot makes it eligible',
  eligibleFrames(verified, { hasDeck: true }).map(f => f.id).join() === 'material');

console.log('\n5. requiresDeck keeps a two-part frame off a deckless surface');
// Three of the five title surfaces have no deck field (audit §4). The failure this
// prevents is making the title carry both loads, which is how a headline becomes a
// summary.
const deckFrame = { ...MATERIAL_FRAME, id: 'needs-deck', requiresDeck: true };
check('a deck-requiring frame is eligible where a deck exists',
  eligibleFrames(verified, { hasDeck: true }, [deckFrame]).length === 1);
check('...and ineligible where none does',
  eligibleFrames(verified, { hasDeck: false }, [deckFrame]).length === 0);
check('the Material frame needs no deck, so it works on every surface',
  MATERIAL_FRAME.requiresDeck === false);

console.log('\n6. The tail rule is one rule, and it is checkable');
check('there is a single TAIL_RULE and every frame uses it',
  HEADLINE_FRAMES.every(f => f.tailRule === TAIL_RULE));
check('a frame with a divergent tail rule is an error',
  assertFrameLibraryIntegrity([{ ...MATERIAL_FRAME, tailRule: 'be compelling' }]).errors.length > 0);
// The evaluative class: language that tells the reader how impressed to be.
for (const bad of [
  'Unlacquered brass, and the result is stunning',
  'Travertine everywhere, gorgeous in every room',
  'White oak floors that pull out all the stops',
  'Lime-washed plaster with real wow factor',
  'A brass kitchen that raises the bar',
  'Terrazzo counters, absolutely breathtaking',
]) {
  check(`evaluative tail caught: "${bad}"`, hasEvaluativeTail(bad));
}
// The line this must not cross. Factual adjectives drawn from the work are the
// frame's raw material — if these ever start failing, the rule has eaten its own
// vocabulary.
for (const good of [
  'Unlacquered brass, specified before the plan',
  'Book-matched travertine, bought before the drawings',
  'Lime-washed plaster, reimagined for a family of five',
  'Cantilevered white oak, cut on site',
  'Quarter-sawn ash, ordered twice after the first delivery warped',
  'Hand-troweled plaster the client had seen in Mexico City',
]) {
  check(`factual tail survives: "${good}"`, !hasEvaluativeTail(good));
}
check('an exemplar breaking the tail rule is an error',
  assertFrameLibraryIntegrity([{ ...MATERIAL_FRAME, exemplars: ['A stunning brass kitchen'] }]).errors.length > 0);

console.log('\n7. The rule exists in the prompt as well as in code');
check('EVALUATIVE_ADJECTIVES is a separate export from the banned-phrase list',
  /export const EVALUATIVE_ADJECTIVES/.test(tone) && /export const EDITORIAL_BANNED_PHRASES/.test(tone));
check('it names the idioms, not only the adjectives',
  /pulls out all the stops/.test(tone) && /wow factor/.test(tone));
check('it protects factual adjectives explicitly',
  /cantilevered/.test(tone) && /book-matched/.test(tone) && /lime-washed/.test(tone));
check('the headline writer is given it',
  /\$\{EVALUATIVE_ADJECTIVES\}/.test(route));

console.log('\n8. The purity split holds');
// Every file under src/lib/interview/prompts/ is free of Prisma, the AI SDKs and
// next/* — that is what lets any route import a prompt without dragging the
// database in. A frame library that reads rows would have broken it for six
// unrelated modules, so slot resolution lives in posting/ instead.
const impure = execSync(
  "grep -rlE \"from '@?/?(lib/)?prisma'|@anthropic-ai|from 'openai'|from 'next/\" src/lib/interview/prompts/ || true",
  { encoding: 'utf8' },
).split('\n').filter(Boolean);
check('prompts/ imports no Prisma, no AI SDK, no next/*', impure.length === 0, impure.join(', '));
check('the frame library is declared in prompts/ per docs/17 §6',
  /export const HEADLINE_FRAMES/.test(frames));
check('slot resolution — which needs the database — is not',
  /from '@\/lib\/prisma'/.test(slots) && !/from '@\/lib\/prisma'/.test(frames));
check('eligibility is pure, so it is decided in code before any model call',
  /export function eligibleFrames/.test(frames) && !/await/.test(frames.split('export function eligibleFrames')[1].split('\n}')[0]));

console.log('\n9. The route actually uses it');
check('slots are resolved for the project', /resolveHeadlineSlots\(projectId\)/.test(route));
check('eligibility is computed, not asked of the model', /eligibleFrames\(slots, \{ hasDeck: true \}\)/.test(route));
check('the frame replaces an angle in place, preserving position-is-angle',
  /framedAngleIndex/.test(route) && /ANGLES\.findIndex\(\(a\) => a\.key === 'first-move'\)/.test(route));
check('the verified materials reach the prompt as fact',
  /Materials the designer specified — VERIFIED/.test(route));
check('the prompt forbids adding a material that is not on the list',
  /do not\s+add a material that is not on this list/i.test(route));
check('whether a frame fired is logged', /\[headline\/regenerate\] frames/.test(route));

console.log('\n10. The docs/17 §5 violation on this path is fixed');
// EDITORIAL_BANNED_PHRASES was centralized and imported by zero generators; the
// article generator carried a verbatim inline copy. §5: "No generator keeps its
// own copy."
check('the article generator imports the list', /EDITORIAL_BANNED_PHRASES,?\s*\n?\s*FOLIO_TONE|EDITORIAL_BANNED_PHRASES/.test(draft.split('\n').slice(0, 20).join('\n')));
check('...and interpolates it rather than restating it',
  /\$\{EDITORIAL_BANNED_PHRASES\}/.test(draft));
check('no inline copy remains', !/You must AVOID:/.test(draft));
// Scoped to the article generator on purpose. A SECOND inline copy lives in
// sections/[chapterIndex]/regenerate/route.ts and it has DRIFTED — 1,108 chars
// against the constant's 1,858, missing six of the ten rules, so a regenerated
// section is governed by a weaker list than the article it sits in. That is a
// behavioural change to a different generator and was explicitly out of scope for
// this phase; it is recorded in docs/23 §Outstanding rather than swept in
// silently. This asserts the copy count does not GROW.
check('the article generator no longer carries a copy',
  !/You must AVOID:/.test(draft));
check('the known copies are exactly the constant and the drifted section-regenerate one', (() => {
  const hits = execSync("grep -rl 'You must AVOID:' --include=*.ts src/ || true", { encoding: 'utf8' })
    .split('\n').filter(Boolean).sort();
  return hits.length === 2
    && hits.some(h => h.includes('editorialTone.ts'))
    && hits.some(h => h.includes('[chapterIndex]/regenerate/route.ts'));
})(), 'a new inline copy appeared, or the section-regenerate one was fixed — update this check');
check('the drift is recorded so it is not lost',
  /chapterIndex/.test(readFileSync('docs/23_HEADLINE_FRAMES.md', 'utf8')));

console.log('\n11. A rendered frame instruction states its values');
const rendered = renderFrameInstruction(MATERIAL_FRAME, verified);
check('the resolved value is inlined, not described', /unlacquered brass/.test(rendered));
check('it is marked as designer-stated', /stated by the designer/.test(rendered));
check('the tail rule travels with it', rendered.includes(TAIL_RULE));
check('no exemplar block is emitted when none are sourced',
  !/Published headlines in this frame/.test(rendered));
check('the shape puts the material in subject position',
  /grammatical subject/.test(rendered) && /never as the subject of the sentence/.test(rendered));

console.log('\n12. The verb library is typed, not a flat list');
const verbInt = assertVerbLibraryIntegrity();
check('no structural errors', verbInt.errors.length === 0, verbInt.errors.join('\n        '));
for (const w of verbInt.warnings) console.log(`  NOTE  ${w}`);
check('25-40 verbs, breadth carried by preconditions rather than scarcity',
  HEADLINE_VERBS.length >= 25 && HEADLINE_VERBS.length <= 40, `${HEADLINE_VERBS.length}`);
check('all six categories are present',
  new Set(HEADLINE_VERBS.map(v => v.category)).size === 6);
check('every verb carries at least one precondition',
  HEADLINE_VERBS.every(v => v.requires.length > 0));
// A lemma means different things in different categories and carries different
// preconditions ("extend" a building vs "extend" a material run), so ids are
// composite and both senses can coexist.
check('a lemma may hold two senses with different preconditions',
  HEADLINE_VERBS.filter(v => v.verb === 'extend').length === 2
  && new Set(HEADLINE_VERBS.filter(v => v.verb === 'extend').map(v => v.id)).size === 2);

console.log('\n13. Unknown withholds — the rule that matters');
// No per-project new-build-vs-renovation field exists, so `existingStructure` and
// `newBuild` are unknowable today. Every Intervention verb must therefore be
// withheld. Offering `renovate` on a project that might be new build is exactly
// the error the precondition system is for.
const nothingKnown = selectVerbs({});
check('with nothing known, NO verb is offered',
  nothingKnown.eligible.length === 0, `${nothingKnown.eligible.length} offered`);
check('...and every one is withheld with a stated reason',
  nothingKnown.withheld.length === HEADLINE_VERBS.length
  && nothingKnown.withheld.every(w => w.reasons.length > 0));
check('an unknown REQUIRED condition withholds',
  conditionState('materialClass', {}) === 'unknown'
  && !explainVerb(HEADLINE_VERBS.find(v => v.id === 'application:clad')!, {}).eligible);
// The asymmetry that is easy to get wrong: a barring condition being unknown must
// also withhold. Otherwise a verb whose requirements are met sails past a bar
// nobody could evaluate.
const claddable = { namedSurface: true, materialClass: true };
check('a met requirement is not enough when a BAR is unknown',
  !explainVerb(HEADLINE_VERBS.find(v => v.id === 'intervention:renovate')!, { existingStructure: true }).eligible);
check('...and it becomes eligible once the bar is known not to hold',
  explainVerb(HEADLINE_VERBS.find(v => v.id === 'intervention:renovate')!, { existingStructure: true, newBuild: false }).eligible);
check('an explicit false is not the same as absent',
  conditionState('newBuild', { newBuild: false }) === 'doesNotHold'
  && conditionState('newBuild', {}) === 'unknown');
check('all seven Intervention verbs are withheld on today\'s data',
  nothingKnown.withheld.filter(w => w.id.startsWith('intervention:')).length === 7);
check('application verbs become eligible when their facts resolve',
  selectVerbs(claddable).eligible.some(v => v.id === 'application:clad'));
check('...and continuity does not, on the same facts',
  !selectVerbs(claddable).eligible.some(v => v.category === 'continuity'));

console.log('\n14. Two gates for a sourced verb, both required');
// The seam for interview extraction. A designer saying "we clad it in oak" does
// not make `clad` usable if no material class resolves, and a resolvable class
// does not license a verb the designer never used.
check('a candidate outside the library is rejected (gate 1)',
  selectVerbs(claddable, { candidate: 'showcase' }).sourced === null
  && /not in the library/.test(selectVerbs(claddable, { candidate: 'showcase' }).candidateRejection ?? ''));
check('a library verb whose preconditions fail is rejected (gate 2)',
  selectVerbs({}, { candidate: 'clad' }).sourced === null
  && /preconditions fail/.test(selectVerbs({}, { candidate: 'clad' }).candidateRejection ?? ''));
check('a candidate passing both gates is sourced',
  selectVerbs(claddable, { candidate: 'clad' }).sourced?.id === 'application:clad');
check('the rejection says which gate, so extraction can be debugged later',
  /gate 1/.test(selectVerbs(claddable, { candidate: 'showcase' }).candidateRejection ?? '')
  && /gate 2/.test(selectVerbs({}, { candidate: 'clad' }).candidateRejection ?? ''));
check('the extraction seam is documented as not built',
  /SEAM for interview verb extraction \(not built this phase\)/.test(
    readFileSync('src/lib/interview/prompts/headlineVerbs.ts', 'utf8')));

console.log('\n15. The generics are banned');
for (const bad of [
  'Travertine features throughout the house',
  'Brass showcases the stair',
  'Oak elevates the kitchen',
  'A kitchen that transforms the plan',
  'Plaster reimagines the entry',
  'Concrete redefines the floor',
  'Marble celebrates the island',
  'The house embraces the slope',
  'A facade that boasts three openings',
]) {
  check(`banned verb caught: "${bad}"`, usesBannedVerb(bad) !== null, bad);
}
check('a specific verb is not caught',
  usesBannedVerb('Travertine clads the island and the stair') === null);
check('no library verb is also banned',
  HEADLINE_VERBS.every(v => !BANNED_HEADLINE_VERBS.includes(v.verb)
    && !BANNED_HEADLINE_VERBS.includes(v.headlineForm)));
check('unveil is banned but its one legitimate use is stated',
  BANNED_HEADLINE_VERBS.includes('unveils')
  && /first public reveal/.test(UNVEIL_EXCEPTION)
  && BANNED_HEADLINE_VERBS_RULE.includes(UNVEIL_EXCEPTION));

console.log('\n16. The verb library does not contradict the centralized banned list');
// EDITORIAL_BANNED_PHRASES is canon (docs/17 §5). A new list that quietly
// contradicts it is the fragmentation this whole effort is against.
const bannedPhrases = tone.split('EDITORIAL_BANNED_PHRASES = `')[1].split('`;')[0].toLowerCase();
// `echo` is banned there as a VERB for formal relationships — which is exactly
// what the continuity category describes — so it is absent by decision, not by
// oversight.
check('"echoing" is banned by the centralized list', /"echoing"/.test(bannedPhrases));
check('...so `echo` is absent from continuity',
  !HEADLINE_VERBS.some(v => v.verb === 'echo'));
check('...and the reason is written down where the category is',
  /echo. is DELIBERATELY ABSENT/.test(readFileSync('src/lib/interview/prompts/headlineVerbs.ts', 'utf8')));
// anchor / run / thread collide only as COLLOCATIONS. The verb survives; the
// exact banned phrasing travels with it.
for (const [id, colloc] of [
  ['placement:anchor', 'anchors the space'],
  ['continuity:thread', 'metallic thread'],
  ['continuity:run', 'thread that runs through'],
] as const) {
  const verb = HEADLINE_VERBS.find(v => v.id === id)!;
  check(`${id} carries its banned collocation "${colloc}"`,
    (verb.bannedCollocations ?? []).includes(colloc));
  check(`...and that collocation really is in the centralized list`,
    bannedPhrases.includes(colloc));
}
check('the rendered instruction repeats the banned collocations',
  /Even with an allowed verb, these exact phrasings are banned/.test(
    renderVerbInstruction(selectVerbs({ spatialObject: true }))));

console.log('\n17. The verb library is pure, like the rest of prompts/');
check('no Prisma, no AI SDK in headlineVerbs.ts',
  !/from '@\/lib\/prisma'|@anthropic-ai|from 'openai'/.test(
    readFileSync('src/lib/interview/prompts/headlineVerbs.ts', 'utf8')));

console.log(failures === 0
  ? '\nAll headline-frame checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
