/**
 * Structural guard: editorial generation has exactly ONE path.
 *
 * Why this exists. The Story/Publish "Regenerate" button and the initial
 * generation must produce articles from the same prompt, forever — a designer
 * clicking Regenerate should never get output from a stale prompt that missed
 * the last three fixes. That was a live risk, not a theoretical one: the
 * generate route carried a full second copy of the editorial system prompt
 * inside dead `composeEditorial` / `composeEditorialHard` functions, and a
 * second `getOrCreateEditorialDraft` entry point built its own GenInput. Both
 * were unreachable, so neither showed up in behavior — but both looked live to
 * a reader, and the dead copies had already drifted so far that they referenced
 * functions that no longer existed in the file.
 *
 * These checks are greps over source, deliberately. The invariant they protect
 * is "there is only one of these in the tree", which types cannot express and a
 * runtime test cannot observe.
 *
 * Run: npm run check:single-generator
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

const CANONICAL_GENERATOR = 'src/lib/posting/generateEditorialDraft.ts';
const CANONICAL_ROUTE = 'src/app/api/posting/project/[projectId]/interview/generate/route.ts';
const PROMPT_MODULE = 'src/lib/interview/prompts/editorialTone.ts';
// Regenerates ONE chapter's body from an existing article. Narrower job, its own
// prompt by design — but it must still share the JSON quoting rule.
const SECTION_REGEN_ROUTE =
  'src/app/api/posting/project/[projectId]/sections/[chapterIndex]/regenerate/route.ts';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC).map((f) => ({ path: relative(ROOT, f).replace(/\\/g, '/'), text: readFileSync(f, 'utf8') }));
const find = (p: string) => files.find((f) => f.path === p);

console.log('\n1. One generator, called from one place');

const callers = files
  .filter((f) => f.path !== CANONICAL_GENERATOR && /\bgenerateEditorialDraft\s*\(/.test(f.text))
  .map((f) => f.path);
check(
  'generateEditorialDraft() is called from exactly one file',
  callers.length === 1 && callers[0] === CANONICAL_ROUTE,
  `callers: ${JSON.stringify(callers)}`,
);

console.log('\n2. One full-article editorial prompt in the tree');

// The signature line of the full-article system prompt.
const PROMPT_SIGNATURE = 'senior writer for a prestigious design magazine, writing a feature article';
const promptOwners = files.filter((f) => f.text.includes(PROMPT_SIGNATURE)).map((f) => f.path);
check(
  'the full-article system prompt is defined in exactly one file',
  promptOwners.length === 1 && promptOwners[0] === CANONICAL_GENERATOR,
  `found in: ${JSON.stringify(promptOwners)}`,
);

// Dead duplicates that previously carried their own copy of the prompt.
for (const ghost of ['composeEditorialHard', 'composeEditorial', 'buildEditorialPrompt', 'getOrCreateEditorialDraft']) {
  const holders = files.filter((f) => new RegExp(`(function|const)\\s+${ghost}\\b`).test(f.text)).map((f) => f.path);
  check(`no \`${ghost}\` alternate generation path exists`, holders.length === 0, `defined in: ${JSON.stringify(holders)}`);
}

console.log('\n3. The Regenerate button targets the canonical route');

const publishFlow = find('src/hooks/usePublishFlow.ts');
check('usePublishFlow.ts exists (owns generateDraft)', !!publishFlow);
if (publishFlow) {
  check(
    'generateDraft() posts to the canonical /interview/generate route',
    /\/interview\/generate\?/.test(publishFlow.text),
    'generateDraft no longer targets /interview/generate — the Regenerate button has forked off the main path',
  );
  const otherGenEndpoints = [...publishFlow.text.matchAll(/`\/api\/posting\/project\/\$\{projectId\}\/([^`?]*)/g)]
    .map((m) => m[1])
    .filter((p) => /generat/i.test(p) && !p.startsWith('interview/generate'));
  check(
    'generateDraft() has no second generation endpoint',
    otherGenEndpoints.length === 0,
    `also posts to: ${JSON.stringify(otherGenEndpoints)}`,
  );
}

console.log('\n4. Every prose-in-JSON prompt shares the quoting rule');

check(
  'the quoting rule lives in the canonical prompt module',
  !!find(PROMPT_MODULE)?.text.includes('export const JSON_PROSE_QUOTING_RULE'),
);
for (const consumer of [CANONICAL_GENERATOR, SECTION_REGEN_ROUTE]) {
  check(
    `${consumer.split('/').pop()} imports JSON_PROSE_QUOTING_RULE rather than restating it`,
    !!find(consumer)?.text.includes('JSON_PROSE_QUOTING_RULE'),
  );
}

console.log('\n5. The room join stays keyed on title, not array position');

const generator = find(CANONICAL_GENERATOR);
check(
  'repairAndBuildBlocks does not read composedChapters by loop index',
  !!generator && !/proofBody\(composedChapters\[i\]/.test(generator.text),
  'the positional pairing that mismatched every room is back',
);

console.log(
  failures === 0
    ? '\nEditorial generation is single-path.\n'
    : `\n${failures} check(s) failed — generation has forked.\n`,
);
process.exit(failures === 0 ? 0 : 1);
