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

import { readFileSync } from 'fs';
import {
  extractQuoteCandidates,
  isVerbatimSpan,
  normalizeForVerbatimCheck,
} from '../src/lib/posting/quoteCandidates';

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

console.log(failures === 0
  ? '\nAll pull-quote checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
