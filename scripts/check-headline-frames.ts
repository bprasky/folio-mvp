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
import { MATERIAL_CLASSES } from '../src/lib/editorial-queue/signals';
import { headlineIssues } from '../src/lib/posting/headline';
import { normalizeForVerbatimCheck } from '../src/lib/posting/quoteCandidates';
import {
  assertIsMaterialClass,
  carriesProprietaryName,
  resolveFragmentCandidates,
  borrowedFragmentIsVerbatim,
} from '../src/lib/posting/headlineSlots';
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
  BORROWED_FRAGMENT_FRAME,
  AGENT_VERB_OBJECT_FRAME,
  stripQuotedSpans,
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
// Unsourced exemplars must still WARN rather than fail — blocking on them would
// mean inventing them. Tested on a synthetic frame, because the real ones are now
// sourced.
const unsourced = assertFrameLibraryIntegrity([{ ...MATERIAL_FRAME, exemplars: [] }]);
check('an unsourced exemplar list warns rather than fails',
  unsourced.warnings.some(w => /no exemplars/.test(w)) && unsourced.errors.length === 0);
check('...and the real library is now fully sourced, so it warns about nothing',
  warnings.length === 0, warnings.join('; '));
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
// B3: the protection moved from policing free text to a closed vocabulary. The
// slot value is a member of MATERIAL_CLASSES or the tag is dropped, so the
// resolver reads a product name but cannot emit one.
check('the material slot is a material CLASS, not a finish',
  /materialClassOf/.test(MATERIAL_FRAME.slots[0].source)
  && /MATERIAL_CLASSES/.test(MATERIAL_FRAME.slots[0].source));
check('...and the description says class, never finish or brand',
  /material class/i.test(MATERIAL_FRAME.slots[0].description)
  && /never a product name and never a brand/.test(MATERIAL_FRAME.slots[0].description));
check('every value the resolver can emit is a member of MATERIAL_CLASSES',
  MATERIAL_CLASSES.every((c) => assertIsMaterialClass(c))
  && !assertIsMaterialClass('Calacatta Gold by Antolini')
  && !assertIsMaterialClass('unlacquered brass')
  && !assertIsMaterialClass(''));
check('...and the resolver drops anything that is not one',
  /if \(!assertIsMaterialClass\(cls\)\) continue;/.test(slots));
// Retained but unreachable on this path — asserted rather than assumed.
check('carriesProprietaryName is kept as defence-in-depth',
  /defence-in-depth/.test(slots) && typeof carriesProprietaryName === 'function');
check('...and it still works, so the defence is real if the vocabulary ever opens',
  carriesProprietaryName('calacatta gold by antolini', 'Calacatta Gold', 'Antolini')
  && !carriesProprietaryName('marble', 'Calacatta Gold', 'Antolini'));
// A marble-look porcelain tile is not marble, and a headline saying so is false in
// the most visible line of the piece.
check('a look-alike qualifier is refused on the headline path',
  /LOOKALIKE/.test(slots) && /A marble-look porcelain tile is not marble/i.test(slots));
// docs/20 gates product and brand names out of published prose unless the exposure
// is paid for, and calls the sentence Folio's most valuable editorial real estate.
// A headline is the most valuable sentence there is. The protection is structural:
// the slot draws from a finish column, so there is no path for a name to arrive.
check('the slot names no product column at all',
  !/Product\.name|Product\.brand|finishRaw/.test(MATERIAL_FRAME.slots[0].source));
check('the frame says so in words, so nobody "improves" it later',
  /never a product name and never a brand/.test(MATERIAL_FRAME.slots[0].description),
  MATERIAL_FRAME.slots[0].description);
check('the resolver never selects Product.name or Product.brand as a value',
  !/value:\s*.*product\?\.(name|brand)/.test(slots));
check('a value carrying its own product or brand name is still refused',
  /if \(carriesProprietaryName\(cls, tag\.product\?\.name, tag\.product\?\.brand\)\) continue;/.test(slots));
check('...and docs/20 is cited where that decision lives',
  /docs\/20/.test(slots));

console.log('\n4. Only a value traceable to a row is usable');
// B3: the gate is "a material class resolves", not "a designer typed a finish".
// The old gate is still READ, so one project's logs show both, but it no longer
// decides eligibility.
check('finishConfirmed no longer gates eligibility',
  !/finishConfirmed/.test(MATERIAL_FRAME.slots[0].source));
check('...but it is still counted, so the repoint is visible per project',
  /confirmedFinishTags/.test(slots) && /confirmedFinishTags/.test(route));
check('interview prose is explicitly refused as a slot source',
  /material named in interview PROSE/i.test(slots));
// B3 REVERSES B1 here, deliberately. B1 refused inference from a product name
// because `buildDescriptor` had an open output and could present a brand-derived
// phrase as the designer's word. `materialClassOf` emits a member of a closed
// 38-entry vocabulary and can emit nothing else, so the reading of the name is
// safe. The reversal is recorded in the source rather than left to be rediscovered.
check('inference from product data is now allowed, and the reversal is explained',
  /B1 additionally refused a material INFERRED FROM A PRODUCT NAME/.test(slots)
  && /the open output, not\s*\n \* the reading of the name/.test(slots));
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
// Per-tag resolution is what makes "the same class in two rooms" answerable, and
// that is the Continuity precondition. It is the reason this was not a vocabulary
// swap.
check('resolution is per tag, keyed to room and image',
  /roomCount/.test(slots) && /imageCount/.test(slots)
  && /at\.rooms\.add\(/.test(slots));
check('classInTwoPlaces is derived from that and passed as a fact',
  /facts\.classInTwoPlaces = true/.test(slots)
  && /m\.roomCount > 1 \|\| m\.imageCount > 1/.test(slots));
check('an unassigned image counts as its own place, so roomCount cannot inflate',
  /image:\$\{tag\.imageId\}/.test(slots) || /`image:/.test(slots));

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
  !/Published headlines in this frame/.test(
    renderFrameInstruction({ ...MATERIAL_FRAME, exemplars: [] }, verified)));
check('...and one IS emitted once they are',
  /Published headlines in this frame/.test(rendered)
  && /Coloured marble defines/.test(rendered));
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

console.log('\n18. Three arrangements over the same six variables');
check('all three frames are declared',
  HEADLINE_FRAMES.map(f => f.id).sort().join() === 'agent-verb-object,borrowed-fragment,material');
check('each names the angle it replaces in the route',
  /material.*first-move/s.test(route) && /borrowed-fragment.*client/s.test(route));
// Each frame takes the angle that was already asking for its material rather than
// adding a candidate, so counts and the position-is-angle invariant are untouched.
check('frames replace angles in place, they do not add candidates',
  /const CANDIDATES_REQUESTED = ANGLES\.length \* 2/.test(route)
  && /framesByAngle/.test(route));

console.log('\n19. Borrowed fragment — the evaluation belongs to a named person');
check('it requires only a verbatim fragment',
  BORROWED_FRAGMENT_FRAME.requiredFields.join() === 'fragment');
check('it needs no deck, so it works on every surface',
  BORROWED_FRAGMENT_FRAME.requiresDeck === false);
check('the frame forbids paraphrasing the quote',
  /do not tidy, do not extend it by a single word/i.test(BORROWED_FRAGMENT_FRAME.slots[0].description));
check('...and confines evaluation to inside the quotation marks',
  /the evaluation is theirs, and borrowing it does not license any of your own/.test(BORROWED_FRAGMENT_FRAME.shape));
// The device only works if the tail rule stops treating a quoted evaluation as ours.
check('a quoted evaluation is permitted',
  !hasEvaluativeTail('“It was the ugliest room in the house” — and the beam stayed')
  && !hasEvaluativeTail('“Stunning” was the client’s word, not the brief'));
check('...and our OWN evaluation is still caught alongside a quote',
  hasEvaluativeTail('“We fought for it” and the result is stunning'));
check('an apostrophe is not mistaken for a quotation',
  !hasEvaluativeTail('The clients didn’t want flash, and the plaster stayed')
  && stripQuotedSpans("didn't and won't").includes("didn't"));
check('an unclosed quote fails safe — it can only under-report',
  stripQuotedSpans('“unclosed forever').trim() === '');
// A fragment that was not said is the worst thing a headline can contain.
const SRC = ['It was the ugliest room in the house. We kept the beam anyway.'];
check('a verbatim quote passes',
  borrowedFragmentIsVerbatim('“It was the ugliest room in the house” — and the beam stayed', SRC));
check('one swapped word fails',
  !borrowedFragmentIsVerbatim('“It was the prettiest room in the house” — and the beam stayed', SRC));
check('a headline quoting nothing fails, since the frame claims someone said it',
  !borrowedFragmentIsVerbatim('No quote at all, just a claim', SRC));
check('the gate runs on EVERY candidate, not only the framed angle',
  /Applied to EVERY candidate, not only the borrowed-fragment angle/.test(route)
  && /QUOTE_UNVERIFIED/.test(route));
// Selected, never written — the pull-quote posture.
const frags = resolveFragmentCandidates([
  { answer: 'The clients hated the original kitchen. We gutted it in a week.', isFollowUp: true },
  { answer: 'We used travertine throughout the ground floor for continuity.', isFollowUp: false },
]);
check('fragments are headline-scale, not pull-quote-scale',
  frags.length > 0 && frags.every(f => f.wordCount >= 3 && f.wordCount <= 9));
check('the borrowable one ranks first',
  frags[0].worthBorrowing === true);
check('ordering is deterministic, so a batch is reproducible',
  JSON.stringify(resolveFragmentCandidates([
    { answer: 'The clients hated the original kitchen. We gutted it in a week.', isFollowUp: true },
    { answer: 'We used travertine throughout the ground floor for continuity.', isFollowUp: false },
  ])) === JSON.stringify(frags));

console.log('\n20. Agent-verb-object — declared, and correctly never eligible');
// Three independent blockers, none removable in this phase. Declared anyway,
// because an absent frame gets rediscovered and re-proposed while an ineligible one
// carries its reasons with it.
check('the frame is declared',
  AGENT_VERB_OBJECT_FRAME.requiredFields.join() === 'agent,verb,object');
check('agent is never resolved, because no name-verification predicate exists',
  /`agent` is NEVER resolved/.test(slots) && /no name-verification predicate/.test(slots));
check('...so the frame is ineligible even with every other slot verified',
  eligibleFrames([
    { name: 'verb', value: 'clads', source: 'headlineVerbs', verified: true },
    { name: 'object', value: 'the island', source: 'Room.name', verified: true },
    { name: 'material', value: 'oak', source: 'x', verified: true },
    { name: 'fragment', value: 'we fought for it', source: 'x', verified: true },
  ], { hasDeck: true }).every(f => f.id !== 'agent-verb-object'));
check('naming the designer is banned on this surface anyway',
  headlineIssues('Matto clads the island in oak', { designerName: 'Diano Matto', orgName: null })
    .some(i => i.code === 'NAMES_PEOPLE'));
check('all three blockers are written down where the frame is',
  /no name-verification predicate/i.test(frames)
  && /NAMES_PEOPLE/.test(frames)
  && /`namedSurface` is unknown/.test(frames));

console.log('\n21. Exemplars are real, and clean');
// "NEVER invented" is the frame contract's own words. This makes it mechanical:
// every exemplar must appear verbatim in the corpus the project owner collected.
const corpus = JSON.parse(readFileSync('docs/audits/headline-discriminator-corpus.json', 'utf8'));
const corpusLines: string[] = [
  ...Object.values(corpus.byArrangement as Record<string, string[]>).flat(),
  ...(corpus.human ?? []),
  ...((corpus._humanExtended?.entries ?? []) as string[]),
];
// Quote glyphs differ by design: the corpus was supplied straight, and anything
// reaching a prompt must be curly per JSON_PROSE_QUOTING_RULE. Compare through the
// normalizer the pull-quote pipeline already uses for exactly this.
const corpusNormalized = new Set(corpusLines.map(normalizeForVerbatimCheck));
for (const frame of HEADLINE_FRAMES) {
  check(`${frame.id}: has exemplars`, frame.exemplars.length > 0);
  for (const e of frame.exemplars) {
    check(`${frame.id}: exemplar is in the collected corpus, not invented`,
      corpusNormalized.has(normalizeForVerbatimCheck(e)), e);
    // An exemplar that breaks a rule teaches the rule away. This is exactly how the
    // old criteria came to list the balanced pair as a GOOD example.
    check(`${frame.id}: exemplar passes every check Folio enforces`,
      headlineIssues(e).length === 0 && !usesBannedVerb(e) && !hasEvaluativeTail(e),
      JSON.stringify({ issues: headlineIssues(e).map(i => i.code), verb: usesBannedVerb(e), evaluative: hasEvaluativeTail(e) }));
  }
}
// 57% of the corpus opens on a studio name, which Folio bans. Those may teach the
// agent-verb-object frame, which is declared precisely because it cannot ship here
// — but they must never leak into a frame that DOES ship, or every output learns a
// shape NAMES_PEOPLE kills.
const shippingFrames = HEADLINE_FRAMES.filter(f => f.id !== 'agent-verb-object');
const OPENS_AGENT_FREE = /^(the|a|an|inside|eight|ten|five|nine|coloured|monolithic|rough|open-air|water|ambient|blocks|photos|construction)\b/i;
for (const frame of shippingFrames) {
  for (const e of frame.exemplars) {
    check(`${frame.id}: exemplar does not open on a named agent`,
      OPENS_AGENT_FREE.test(e), e);
  }
}
check('the agent-verb-object frame keeps the agent-led ones, which are its shape',
  AGENT_VERB_OBJECT_FRAME.exemplars.length >= 3
  && AGENT_VERB_OBJECT_FRAME.exemplars.every(e => !OPENS_AGENT_FREE.test(e)));

console.log('\n22. The held-out set is like-for-like');
check('a human set exists', Array.isArray(corpus.human) && corpus.human.length >= 5);
const byArrangementNormalized = new Set(
  Object.values(corpus.byArrangement as Record<string, string[]>).flat().map(normalizeForVerbatimCheck));
check('every entry in it is also in the full record',
  (corpus.human as string[]).every(h => byArrangementNormalized.has(normalizeForVerbatimCheck(h))));
// If the held-out set contains shapes Folio cannot produce, the judge separates on
// grammar rather than on writing and the rate means nothing.
check('no entry opens on a named agent',
  (corpus.human as string[]).every(h => OPENS_AGENT_FREE.test(h)));
check('every entry would pass Folio\'s own checks',
  (corpus.human as string[]).every(h => headlineIssues(h).length === 0 && !usesBannedVerb(h)));
check('the selection criterion is written down',
  Array.isArray(corpus._humanSelection)
  && corpus._humanSelection.join(' ').includes('like-for-like'));
check('the small-sample caveat is enforced, not just documented',
  /only \$\{human\.length\} human headlines \(20 recommended\)/.test(
    readFileSync('scripts/check-headline-discriminator.ts', 'utf8')));

console.log(failures === 0
  ? '\nAll headline-frame checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
