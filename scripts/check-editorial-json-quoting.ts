/**
 * Regression check for the LLM_JSON_PARSE class of editorial generation failures.
 *
 * The production failure this guards (correlation generate_09e1580e3de6): the model
 * emitted a straight double quote inside a body paragraph — a nested quotation
 * within a longer designer quote — which terminated the JSON string 15,799 bytes
 * into a 20KB response and discarded a two-minute generation.
 *
 * The fix is prompt-level: prose uses typographic curly quotes, which need no
 * escaping and cannot terminate a JSON string. This script proves the failing
 * payload still fails (so the diagnostic keeps working), the curly-quote form
 * parses, and every downstream consumer of quoted prose survives the switch.
 *
 * Run: npm run check:json-quoting
 */

// The Anthropic client is constructed at module load in generateEditorialDraft.
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import {
  describeJsonParseFailure,
  extractPullQuotesForChapter,
  proofOutsideQuotes,
} from '../src/lib/posting/generateEditorialDraft';
import { JSON_PROSE_QUOTING_RULE } from '../src/lib/interview/prompts/editorialTone';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

// The exact shape of the production failure, reduced to one paragraph. Note the
// nesting the model actually produced: single quotes at the outer level (copied
// from the prompt's own example delimiters) and a raw straight double quote for
// the quotation nested inside it. Only that inner quote is unescaped, which is why
// the parse survived 15,799 bytes before dying mid-paragraph.
const BROKEN_PARAGRAPH =
  `'We loved the idea of the marble and the plaster working together,' he says. ` +
  `'We didn't have our hearts set on anything in particular when we went, but this quickly became "it."'`;

const FIXED_PARAGRAPH =
  `“We loved the idea of the marble and the plaster working together,” he says. ` +
  `“We didn't have our hearts set on anything in particular when we went, but this quickly became ‘it.’”`;

const asJson = (paragraph: string) => `{"galleryChapters":[{"title":"Primary Bathroom","body":["${paragraph}"]}]}`;

console.log('\n1. The production failure reproduces, and the diagnostic localizes it');

let brokenError: unknown = null;
try {
  JSON.parse(asJson(BROKEN_PARAGRAPH));
} catch (err) {
  brokenError = err;
}
check('an unescaped straight quote inside prose still breaks JSON.parse', brokenError !== null);

if (brokenError) {
  const diag = describeJsonParseFailure(asJson(BROKEN_PARAGRAPH), brokenError);
  check('the diagnostic reports a parse position', typeof diag.position === 'number', `got ${diag.position}`);
  check(
    'the snippet marks the offending span',
    diag.snippet.includes('⟪HERE⟫') && diag.snippet.includes('became'),
    diag.snippet,
  );
}

console.log('\n2. The curly-quote form the prompt now mandates parses cleanly');

let parsedFixed: any = null;
try {
  parsedFixed = JSON.parse(asJson(FIXED_PARAGRAPH));
} catch (err: any) {
  check('curly-quoted prose parses', false, err?.message);
}
check('curly-quoted prose parses with no escaping', parsedFixed !== null);
check(
  'the paragraph survives the round trip verbatim',
  parsedFixed?.galleryChapters?.[0]?.body?.[0] === FIXED_PARAGRAPH,
);

console.log('\n3. The prompt rule states the constraint the model has to follow');

check('the rule bans the straight double quote', /straight double quote/i.test(JSON_PROSE_QUOTING_RULE));
check('the rule names the curly replacements', JSON_PROSE_QUOTING_RULE.includes('“') && JSON_PROSE_QUOTING_RULE.includes('”'));
check('the rule preserves the straight apostrophe for contractions', /apostrophe/i.test(JSON_PROSE_QUOTING_RULE));

console.log('\n4. Downstream pull-quote extraction still works on curly-quoted prose');

const curlyBody = [
  `“We almost went polished nickel but brass felt right for this house,” Matto says.`,
  `Above the vanity, the sconces read warmer than the drawings promised.`,
];
const curlySelection = extractPullQuotesForChapter(curlyBody, 'Diano Matto');
check('a curly-quoted attributed quote is extracted', !!curlySelection?.selected?.text, JSON.stringify(curlySelection?.selected));
check(
  'the extracted text excludes the quote marks themselves',
  !!curlySelection?.selected?.text && !/[“”]/.test(curlySelection.selected.text),
  curlySelection?.selected?.text,
);

const straightBody = [
  `"We almost went polished nickel but brass felt right for this house," Matto says.`,
  `Above the vanity, the sconces read warmer than the drawings promised.`,
];
const straightSelection = extractPullQuotesForChapter(straightBody, 'Diano Matto');
check(
  'straight-quoted prose (existing published posts) extracts identically',
  straightSelection?.selected?.text === curlySelection?.selected?.text,
  `straight=${straightSelection?.selected?.text} curly=${curlySelection?.selected?.text}`,
);

console.log('\n5. proofOutsideQuotes honors its "never alter quoted text" contract for curly quotes');

check(
  'lowercase sentence starts inside a curly quote are left alone',
  proofOutsideQuotes(`Matto pauses. “we went back and forth. it took three tries.”`) ===
    `Matto pauses. “we went back and forth. it took three tries.”`,
  proofOutsideQuotes(`Matto pauses. “we went back and forth. it took three tries.”`),
);
check(
  'lowercase sentence starts outside quotes are still fixed',
  proofOutsideQuotes(`the slab arrived cracked. it turned out better.`) ===
    `The slab arrived cracked. It turned out better.`,
  proofOutsideQuotes(`the slab arrived cracked. it turned out better.`),
);
// Straight-quoted prose is what every existing draft and published post contains,
// so the curly-aware rewrite must be byte-identical to the implementation it
// replaced on that input. Compare against the original rather than against a
// hand-written expectation — the point is "nothing changed", not "this is ideal".
// (It is not ideal: a sentence start after a closing quote is never capitalized,
// because the period sits inside the quoted span. That was true before too.)
function proofOutsideQuotesLegacy(paragraph: string): string {
  if (!paragraph || !paragraph.trim()) return paragraph;
  const result = paragraph.trim();
  const parts = result.split(/"([^"]*)"/g);
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i]) {
      parts[i] = parts[i].replace(/(^|\.\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
    }
  }
  return parts.join('"');
}

const legacyFixtures = [
  `Matto pauses. "we went back and forth." then it landed.`,
  `"We almost went polished nickel," Matto says. "brass felt right."`,
  `the slab arrived cracked. it turned out better than the original.`,
  `he said "hi. and left.`,
  `  leading and trailing whitespace. and a second sentence.  `,
  `no quotes at all here.`,
  ``,
];
for (const fixture of legacyFixtures) {
  const next = proofOutsideQuotes(fixture);
  const prev = proofOutsideQuotesLegacy(fixture);
  check(
    `straight-quoted input unchanged vs. legacy: ${JSON.stringify(fixture.slice(0, 46))}`,
    next === prev,
    `now=${JSON.stringify(next)} legacy=${JSON.stringify(prev)}`,
  );
}

check(
  'an unpaired quote does not swallow the rest of the paragraph',
  proofOutsideQuotes(`he said "hi. and left.`) === `He said "hi. And left.`,
  proofOutsideQuotes(`he said "hi. and left.`),
);
check(
  'mixed curly and straight spans both stay intact',
  proofOutsideQuotes(`“first,” he said. "second," she said. then quiet.`) ===
    `“first,” he said. "second," she said. Then quiet.`,
  proofOutsideQuotes(`“first,” he said. "second," she said. then quiet.`),
);

console.log(
  failures === 0
    ? '\nAll editorial JSON-quoting checks passed.\n'
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
