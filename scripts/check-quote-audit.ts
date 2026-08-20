/**
 * Guards the article quote audit itself.
 *
 * The audit's whole job is to tell three things apart that all fail a plain
 * substring check: a repaired transcript typo, a changed claim, and an invented
 * sentence. An earlier version of it scored the first two by character edit
 * distance and blessed anything within two characters — which classified
 * `on tension` -> `in tension`, the alteration that actually shipped once, as a
 * harmless typo fix. These cases exist so that cannot come back.
 *
 * Fixtures are real: the answers below are the designer's own words, typos
 * intact, from the La Gorce interview.
 *
 * Run: npm run check:quote-audit
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { collectQuotes, verify, extractProseQuotes } from './audit-article-quotes';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

console.log('\n1. The shipped defect stays caught, and stays un-excused');
{
  const answers = [
    { answer: "We definitely didn't want a monochromatic interior like the ones that are so popular in Miami these days. We feel it will be more timeless to introduce these elements on tension.", section: 'Primary Bathroom', isFollowUp: true, origin: 't' },
    { answer: 'The slab arrived cracked and we kept it, because the fracture told you it was real.', section: 'Kitchen', isFollowUp: true, origin: 't' },
  ];
  const blocks = {
    hookQuote: { text: 'We feel it will be more timeless to introduce these elements on tension' },
    introduction: ['The house resists trend. “We wanted the house to sing with light,” Rivera says.'],
    galleryChapters: [{
      title: 'Primary Bathroom',
      body: ['Rivera recalls, “We feel it will be more timeless to introduce these elements in tension.” Prose about “brass” as a finish.'],
      pullQuote: {
        selected: { text: "We definitely didn't want a monochromatic interior" },
        alternatives: [
          { text: "We definitely didn't want a monochromatic interior", score: 1 },
          { text: 'The slab arrived cracked and we kept it, because the fracture told you it was real.', score: 0.9 },
        ],
      },
    }],
  };
  const found = collectQuotes(blocks).map(q => verify(q, answers as any));
  const f = (t: string) => found.find(x => x.text.includes(t))!;

  check('a one-word swap is reported, never blessed as a small edit',
    f('elements in tension').verdict === 'ALTERED', JSON.stringify(f('elements in tension')));
  check('the report names the swapped word', 
    (f('elements in tension').changes ?? []).some(c => c.from === 'on' && c.to === 'in'));
  check('it points at what the designer actually said',
    (f('elements in tension').source?.text ?? '').includes('elements on tension'));
  check('a fully invented line is INVENTED, not merely altered',
    f('sing with light').verdict === 'INVENTED', JSON.stringify(f('sing with light')));
  check('a verified hook quote passes', f('elements on tension').verdict === 'VERBATIM');
  check('a verbatim chapter pull quote passes',
    f("didn't want a monochromatic interior").verdict === 'VERBATIM');
  check('a Kitchen line offered under Primary Bathroom is flagged',
    f('slab arrived cracked').verdict === 'WRONG_ROOM' && f('slab arrived cracked').actualRoom === 'Kitchen');
  check('the selected quote is not double-reported as its own alternative',
    found.filter(x => x.text.includes("didn't want a monochromatic interior")).length === 1);
  check('a scare-quoted material name is not mistaken for speech',
    extractProseQuotes('Prose about “brass” as a finish.').length === 0);
}

console.log('\n2. Real transcript typos are surfaced with the exact repair');
{
  const answers = [
    { answer: 'Anytime you style onsite its hard to know exactly what wll look good.', section: 'what', isFollowUp: true, origin: 't' },
    { answer: 'The interior has a lot of character, color, and different finishes, whole the exterior is intentionally reserved.', section: 'what', isFollowUp: false, origin: 't' },
    { answer: 'We loved this contrast. Miami can be a bit flashy at times and they are not those people.', section: 'what', isFollowUp: true, origin: 't' },
    { answer: 'We use paneling strategically in our projects and throughout the house.', section: 'what', isFollowUp: false, origin: 't' },
    { answer: 'The fireplace stone obviously has the most gravity here.', section: 'Formal Living Room', isFollowUp: false, origin: 't' },
  ];
  const blocks = {
    galleryChapters: [
      { title: 'Living Room', body: ['“Anytime you style onsite its hard to know exactly what will look good.”'] },
      { title: 'Exterior', body: [
        '“The interior has a lot of character, color, and different finishes, while the exterior is intentionally reserved.”',
        '“Miami can be a bit flashy at times and they are not those people. So it comes full circle when the entire project reflects your clients as people.”',
      ] },
      { title: 'Entry', body: ['“We use paneling strategically in our projects and throughout the house.”'] },
      { title: 'Formal Living Room', body: ['“The fireplace stone obviously has the most gravity here.”'] },
    ],
  };
  const found = collectQuotes(blocks).map(q => verify(q, answers as any));
  const f = (t: string) => found.find(x => x.text.includes(t))!;

  check('a repaired typo is reported with the word pair, for a human to rule on',
    f('style onsite').verdict === 'ALTERED'
    && (f('style onsite').changes ?? []).some(c => c.from === 'wll' && c.to === 'will'),
    JSON.stringify(f('style onsite')));
  check('a repair mid-quote reports only the word that moved',
    (f('lot of character').changes ?? []).every(c => c.from === 'whole' && c.to === 'while'),
    JSON.stringify(f('lot of character')));
  check('a quote with an unsourced second sentence is flagged',
    f('full circle').verdict !== 'VERBATIM', JSON.stringify(f('full circle')));
  check('and the unsourced half is named sentence by sentence',
    (f('full circle').sentences ?? []).some(s => !s.verbatim && s.text.includes('full circle')));
}

console.log('\n3. Missing room labels never manufacture a misattribution');
{
  // Answers do not always carry a room. Scoping a chapter's quotes against an
  // empty set would report the whole article as quoted from the wrong room.
  const answers = [
    { answer: 'We use paneling strategically in our projects and throughout the house.', section: 'what', isFollowUp: false, origin: 't' },
    { answer: 'The fireplace stone obviously has the most gravity here.', section: 'Formal Living Room', isFollowUp: false, origin: 't' },
  ];
  const blocks = { galleryChapters: [
    { title: 'Entry', body: ['“We use paneling strategically in our projects and throughout the house.”'] },
    { title: 'Formal Living Room', body: ['“The fireplace stone obviously has the most gravity here.”'] },
  ] };
  const found = collectQuotes(blocks).map(q => verify(q, answers as any));
  check('an unlabelled answer verifies against the whole interview instead',
    found.find(x => x.text.includes('paneling'))!.verdict === 'VERBATIM');
  check('a room that DOES have labelled answers still verifies room-scoped',
    found.find(x => x.text.includes('fireplace'))!.verdict === 'VERBATIM');
}

console.log(failures === 0
  ? '\nAll quote-audit checks passed.\n'
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
