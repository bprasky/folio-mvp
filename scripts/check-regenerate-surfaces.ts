/**
 * Guards the three "regenerate / choose again" surfaces: section body, headline,
 * and pull quote. They look alike to a designer and are governed very
 * differently, and each of those differences is load-bearing.
 *
 *   SECTION BODY  — rewritten by a model, so it must pass the same gates final
 *                   prose passes anywhere else.
 *   HEADLINE      — the model's sentence. Regenerated as a BATCH that is filtered
 *                   by house style, and the designer may also type their own.
 *   PULL QUOTE    — the designer's own sentence. Selected, never written.
 *
 * Run: npm run check:regenerate-surfaces
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const regen = readFileSync('src/app/api/posting/project/[projectId]/sections/[chapterIndex]/regenerate/route.ts', 'utf8');
const override = readFileSync('src/app/api/posting/project/[projectId]/sections/override/route.ts', 'utf8');
const headlineRoute = readFileSync('src/app/api/posting/project/[projectId]/sections/headline/regenerate/route.ts', 'utf8');
const picker = readFileSync('src/components/story/PullQuotePicker.tsx', 'utf8');

console.log('\n1. Regenerated prose passes the same gate as generated prose');
// The Product Naming Gate is a commercial gate: an unsubscribed vendor's name
// reaches a published article only through a hole. It used to live inside the
// full generator, so section regenerate wrote around it.
check('the naming gate has ONE implementation', (() => {
  const hits = execSync("grep -rl 'scrubProseNaming(' --include=*.ts src/lib/ || true", { encoding: 'utf8' })
    .split('\n').filter(Boolean).filter(f => !f.includes('scrubProse.ts'));
  return hits.length === 1 && hits[0].includes('applyProseNamingGate.ts');
})());
check('section regenerate runs the gate before saving',
  /applyProseNamingGate\(/.test(regen) && /source: 'section-regenerate'/.test(regen));
check('it gates against EVERY product on the project, not just this section\'s',
  /where: \{ image: \{ projectId \} \}/.test(regen));
check('it persists the GATED blocks, never the pre-gate text',
  /expandedBlocks: gatedBlocks as any/.test(regen) && !/expandedBlocks: blocks as any/.test(regen));
check('and returns the gated body to the client too',
  /body: savedBody/.test(regen));
check('the full generator delegates to the same shared gate',
  /applyGate\(blocks, \{/.test(readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8')));

console.log('\n2. A section with no source material is refused, not invented');
// The prompt says a direct quote is MANDATORY. With no answers, that is an
// instruction to fabricate one.
check('regenerating with zero answers returns an error, not prose',
  /code: 'NO_ANSWERS'/.test(regen));
check('regenerating a room with no answers of its own is refused too',
  /code: 'NO_ROOM_ANSWERS'/.test(regen));
check('the "No interview data available." placeholder is gone',
  !/No interview data available/.test(regen));

console.log('\n3. A section draws from its OWN room');
check('room matching is whole-word, not substring ("Entry" vs "Entryway")',
  /namesThisRoom/.test(regen) && !/chapterTitle\.includes\(roomName\.toLowerCase\(\)\)/.test(regen));
check('this room\'s answers are still labelled the primary quote source',
  /PRIMARY source for quotes/.test(regen));
check('other rooms are still passed as context only',
  /for context only — do not repeat their content/.test(regen));
check('the chapter\'s pull quote survives a body regeneration',
  /pullQuote: chapter\.pullQuote/.test(regen));

console.log('\n4. Pull quotes are selected, never written');
check('the picker renders the quote as static text, not an input',
  /<blockquote/.test(picker) && !/EditableParagraph/.test(picker));
check('the picker only PATCHes text taken from alternatives',
  /patch\(alternatives\[nextIndex\]\.text\)/.test(picker) && /patch\(alternatives\[0\]\.text\)/.test(picker));
// Two endpoints wrote this one field under two contracts. The weaker one wins by
// definition, so the weaker one is now closed.
check('the override endpoint refuses free-text pull quote writes',
  /code: 'PULL_QUOTE_NOT_EDITABLE'/.test(override));
check('the dedicated endpoint still validates against alternatives',
  /alternatives\.find\(\(a: any\) => a\.text === selectedText\)/.test(
    readFileSync('src/app/api/posting/project/[projectId]/sections/pull-quote/route.ts', 'utf8')));

console.log('\n5. Headlines are proposed in batches and filtered by house style');
check('the endpoint writes from the SHARED criteria',
  /HEADLINE_CRITERIA/.test(headlineRoute));

// The endpoint used to see only the article's own introduction, hook quote and
// current headline — prose that has ALREADY abstracted the project. With nothing
// but abstractions to work from it recombined their vocabulary: a deck reading
// "every room argues its own case" produced "the exterior stays quiet so the
// rooms can argue". Arrangement in, arrangement out.
check('the headline writer is given the INTERVIEW, not just the article',
  /resolveProjectHeadlineSlots\(projectId\)/.test(headlineRoute));
// Follow-up-first ordering was for the ROOM answers, which this surface no longer
// reads. The project answers are ordered by QUESTION instead — the five read as an
// opening statement (who it was for, the limits, the idea, what changed) and
// shuffling them costs that. Follow-ups to a project question ride with their parent.
check('project answers are ordered by question, not by save order',
  /PROJECT_QUESTION_CATEGORIES\.flatMap/.test(headlineRoute));
// Wrap-insensitive on purpose: the rule is the four verbs, not where the line breaks.
check('the answers are labelled as the source, and events are what is asked for',
  /WAS DECIDED,\s+WENT\s+WRONG,\s+WAS\s+NEARLY\s+DIFFERENT,\s+or\s+COST\s+SOMETHING/.test(headlineRoute)
  && /THIS IS YOUR ONLY SOURCE MATERIAL/.test(headlineRoute));
check('the article\'s own prose is labelled context, NOT source material',
  /## Context, NOT source material/.test(headlineRoute)
  && /Do not mine them for phrasing/.test(headlineRoute));
check('inventing an event is refused rather than filled in',
  /Never state something the designer did not say happened/.test(headlineRoute));

// One instruction repeated N times returns N versions of one thought. Named
// angles make the spread structural rather than hoped for.
// The angle list is per-project — project-grain angles appear only when their frame
// is eligible — so the count is computed rather than a constant. The invariant it
// protects is unchanged: candidates are asked for per NAMED angle, never N free-form.
// C3 made the per-angle block size vary so a one-angle project still gets a pool.
check('candidates are requested one per angle, not N free-form',
  /const eligibleAngles = PROJECT_GRAIN_ANGLES/.test(headlineRoute)
  && /const perAngle = Math\.min\(MAX_PER_ANGLE, /.test(headlineRoute)
  && /const CANDIDATES_REQUESTED = angles\.length \* perAngle/.test(headlineRoute));
check('every angle asks for something that HAPPENED',
  /reversal/.test(headlineRoute) && /constraint/.test(headlineRoute)
  && /accident/.test(headlineRoute) && /first-move/.test(headlineRoute));
// Taking survivors in order would fill the pool from the first few angles —
// six phrasings of one idea, which is the flat batch this prevents.
check('the kept set spans angles rather than taking the first N survivors',
  /const rank = \(i: number\) => \(i % perAngle\) \* angles\.length \+ Math\.floor\(i \/ perAngle\)/.test(headlineRoute)
  && !/if \(kept\.length >= CANDIDATES_KEPT\) break/.test(headlineRoute));
check('how many angles actually survived is logged',
  /anglesCovered/.test(headlineRoute));
check('every candidate is graded by the same machine check',
  /headlineIssues\(text\)/.test(headlineRoute));
// The credited name used to be passed IN so a headline could be rejected for
// containing it — "A house Matto never had to redraw" had shipped with the byline
// directly beneath it. B8 reversed that on corpus evidence (57% of published design
// headlines open on the credited party), and the name is now an input to the
// Agent-verb-object frame rather than a disqualifier.
// The `agent` slot went with the material-grain frames to the caption layer. What
// B8 actually settled — that naming the designer is not itself a disqualifier —
// still holds and is what this now asserts.
check('the credited name is not a disqualifier',
  !/headlineIssues\(text, names\)/.test(headlineRoute)
  && /Credited to:/.test(headlineRoute));
check('...and the prompt no longer forbids using it',
  !/do NOT name them in the headline/.test(headlineRoute));
// B9: drops on BLOCKING issues only. TITLE_CASE is a heuristic this pipeline always
// documented as a warning, and dropping on it threw away good headlines over a house
// convention a designer can fix in the preview in seconds.
check('candidates that fail house style are dropped, not offered',
  /rejected\.push\(/.test(headlineRoute) && /if \(blocking\.length > 0\)/.test(headlineRoute));
check('...but a warning keeps the candidate and is surfaced instead',
  /kept with warnings/.test(headlineRoute));
check('an all-bad batch offers nothing rather than the least-bad',
  /code: 'NO_USABLE_CANDIDATES'/.test(headlineRoute));
check('the live headline is NOT replaced by regenerating',
  /kickerAlternatives: \{ selected, alternatives \}/.test(headlineRoute)
  && !/kicker: kept\[0\]/.test(headlineRoute)
  && !/blocks\.lead\.kicker =/.test(headlineRoute));
// The stored list IS the pool the picker walks, so the headline being replaced
// has to be in it — a pool that reorders around whichever entry is live cannot
// be cycled past two.
check('the batch includes the headline it would replace',
  /const alternatives = \[\.\.\.carried, \.\.\.kept, \.\.\.survivingOther\]/.test(headlineRoute));
// ...but only if it passes the rules everything else in the pool had to pass. See
// check-headline.ts for why an ungated carry-over was a hole the size of the rule set.
check('...and the carried headline is re-gated on the way in',
  /!hasWeakPredicate\(currentKicker\)/.test(headlineRoute));
// The read path re-grades stored pools so a shape banned this week is retired from
// batches written before the ban. hasWeakPredicate shipped route-only, so it was
// missing here and stale pools could not self-clean.
const tiles = readFileSync('src/lib/story/buildRoomTiles.ts', 'utf8');
check('the read-path re-grade runs EVERY mechanical check, not just blockingIssues',
  /blockingIssues\(a\.text\)\.length === 0 && !hasWeakPredicate\(a\.text\)/.test(tiles));
check('the current headline is excluded from its own replacements',
  /if \(currentKicker\) seen\.add\(/.test(headlineRoute));
check('duplicates within a batch are dropped',
  /seen\.has\(key\)/.test(headlineRoute));
// P1 moved the pool from `string[]` to `{selected, alternatives:[{text, angle,
// angleLabel}]}` so the angle survives to the frontend. The union arm is not
// optional: every pool in production is a bare array, and BlocksSchema is strict, so
// dropping the legacy shape would silently empty the picker for existing projects.
const schemaSrc = readFileSync('src/lib/posting/schemas.ts', 'utf8');
check('alternatives are declared on the schema so strict parsing keeps them',
  /kickerAlternatives: z\.union\(\[/.test(schemaSrc)
  && /TitleSelectionSchema,/.test(schemaSrc));
check('...and the legacy string[] shape is still accepted, as pull quotes do',
  /z\.array\(z\.string\(\)\.max\(120\)\)\.max\(16\),/.test(schemaSrc)
  && /export function normalizeTitleAlternatives/.test(schemaSrc));
const headlinePicker = readFileSync('src/components/story/HeadlinePicker.tsx', 'utf8');
check('choosing one goes through the ordinary headline edit path',
  /edit\.save\(LEAD, 0, 'kicker', next\.text\)/.test(headlinePicker));
// P1. The deck used to come out of the same call as the kicker, so picking a new
// title left a deck written to sit under the one the designer rejected.
check('choosing a title then rewrites the deck to fit it',
  /sections\/deck\/regenerate/.test(headlinePicker));
check('...and a deck that fails to rewrite does not cost the chosen title',
  /the title is saved; the deck simply stays as it was/.test(headlinePicker));
// The most actionable message in the flow, and it was one line of grey error text.
check('the no-angle state names the unanswered questions as a to-do',
  /data\?\.code === 'NO_ELIGIBLE_ANGLE'/.test(headlinePicker)
  && /Answer a few more opening questions/.test(headlinePicker));

console.log('\n6. An existing article can get its pull quotes without regenerating');
// Candidates are cut from the interview by code and only RANKED by a model, so
// they can be produced after the fact — the alternative was regenerating the
// whole feature, which rewrites prose the designer may have already edited.
const backfill = readFileSync('src/app/api/posting/project/[projectId]/sections/pull-quotes/backfill/route.ts', 'utf8');
check('the backfill selects from interview answers, not from the prose',
  /selectPullQuotes\(/.test(backfill) && /loadInterviewAnswers\(/.test(backfill));
check('it never overwrites a quote the designer already has',
  /if \(getSelectedPullQuoteText\(ch\.pullQuote\)\)/.test(backfill) && /skippedExisting\.push/.test(backfill));
check('it skips photo-only gallery chapters',
  /ch\?\.kind === 'gallery'/.test(backfill));
check('it refuses when there are no answers rather than inventing',
  /code: 'NO_ANSWERS'/.test(backfill));
check('it rebuilds the top-level index the layout engine reads',
  /syncPullQuotesFromChapters\(blocks\)/.test(backfill));
check('a room with nothing quotable is reported, not filled',
  /noCandidate\.push\(title\)/.test(backfill));

// The empty state was `return null`, which is indistinguishable from "this
// feature does not exist" — and it is the state every chapter of a
// pre-room-fix article is in.
check('the picker offers the backfill instead of rendering nothing',
  !/^\s*return null;\s*$/m.test(picker) && /Add a pull quote from the interview/.test(picker));

// Both stores, or projects interviewed through the other surface look empty.
const loader = readFileSync('src/lib/posting/loadInterviewAnswers.ts', 'utf8');
check('answers are read from BOTH provenance and the projection table',
  /interview\?\.payload/.test(loader) || /provenance as any\)\?\.interview\?\.payload/.test(loader));
check('...and the table is read too', /interview\?\.answers \?\? \[\]/.test(loader));
check('roomId is resolved through the SAME resolver the images use',
  /buildRoomResolver\(rooms\)/.test(loader));
check('de-dupe is keyed on room AND text, so one sentence about two rooms survives',
  /\$\{a\.section\.toLowerCase\(\)\}::/.test(loader));

// C1. `section` is the ROOM on a loaded answer, and two consumers match it against
// a chapter title (quoteCandidates, selectPullQuotes) — so it could not be
// repurposed to carry the question category, and was not. The category rides
// alongside instead, recovered from the `project-<CATEGORY>-<uuid>` id because no
// column records it. Before this, all five project answers reached the headline
// prompt tagged `[General]`, indistinguishable from an unassigned room answer.
check('the loaded answer carries the question category BESIDE the room, not instead of it',
  /category: ProjectQuestionCategory \| null/.test(loader)
  && /section: string/.test(loader));
check('the category is matched against the canonical list, not split out of the id',
  /PROJECT_QUESTION_CATEGORIES\.find/.test(loader)
  && /startsWith\(`project-\$\{c\}-`\)/.test(loader));
check('a follow-up inherits its parent\'s category, from BOTH stores or they disagree',
  /parentQuestionId \?\? a\?\.parent_question_id/.test(loader)
  && /questionIdByRowId/.test(loader));
check('...and the category is in the de-dupe key, which is why they must agree',
  /\$\{a\.category \?\? ''\}::/.test(loader));

// The five opening answers are the only project-GRAIN material in the interview.
// The prompt names them as such; the editor still sees both, or it would cut the
// headlines this split exists to enable.
// C2 split the two blocks apart. The rebuild went further: the room block is gone.
// While it was in the prompt the writer kept reaching for it, because the article's
// own rooms were the most concrete thing on the page — "BP Design clads the Dining
// Room in glass" is what that produces.
check('the prompt carries project answers ONLY, with no room block',
  /What the designer told us about this project/.test(headlineRoute)
  && !/roomAnswerText/.test(headlineRoute)
  && !/room by room/.test(headlineRoute));
check('project answers are labelled by what was asked, not by category name',
  /PROJECT_ANSWER_LABELS: Record<ProjectQuestionCategory, string>/.test(headlineRoute));
// The editor checks a candidate against the interview it was written from. Now that
// the writer sees only the project answers, so must it — handed more, it would keep
// headlines grounded in evidence the writer was never allowed to use.
check('the editor is given exactly what the writer was given',
  /interview: answerText/.test(headlineRoute)
  && /const answerText = PROJECT_QUESTION_CATEGORIES\.flatMap/.test(headlineRoute));

console.log(failures === 0
  ? '\nAll regenerate-surface checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
