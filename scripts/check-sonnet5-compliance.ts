/**
 * Guards the Sonnet 5 request surface.
 *
 * Sonnet 5 changed what `messages.create` accepts, and both changes fail in ways
 * that are easy to reintroduce and unpleasant to debug:
 *
 *   1. `temperature` / `top_p` / `top_k` return 400 on non-default values. A
 *      single one added back to a prompt-tuning PR takes that endpoint down.
 *   2. Omitting `thinking` runs ADAPTIVE thinking, where Sonnet 4.6 ran
 *      thinking-off. Thinking shares the `max_tokens` budget with the response,
 *      so a call sized on 4.6 can silently truncate. Every Sonnet call therefore
 *      passes `thinking` explicitly.
 *
 * Neither is caught by tsc — the SDK types accept `temperature`, and a missing
 * `thinking` is valid TypeScript. So they get checked here.
 *
 * Haiku and Opus call sites are deliberately out of scope: Haiku 4.5 still
 * accepts sampling params, and there is exactly one such call (the sentence-opener
 * fixer in generateEditorialDraft).
 *
 * Run: npm run check:sonnet5
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

import { MODELS, LEGACY_MODEL_IDS } from '../src/lib/ai/models';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

const SONNET_MODEL_LINE = /^\s*model:\s*(MODELS\.sonnet|modelName),?\s*$/;
const SAMPLING_LINE = /^\s*(temperature|top_p|top_k)\s*:/;
const THINKING_LINE = /thinking:\s*\{\s*type:\s*['"](disabled|adaptive)['"]/;

console.log('\n1. Both model registries point at Sonnet 5');

check('src/lib/ai/models.ts uses claude-sonnet-5', MODELS.sonnet === 'claude-sonnet-5', MODELS.sonnet);

const serviceModels = readFileSync('services/interview-orchestration/src/models.ts', 'utf8');
check(
  'services/interview-orchestration uses claude-sonnet-5',
  /sonnet:\s*'claude-sonnet-5'/.test(serviceModels),
  serviceModels.split('\n').find(l => l.includes('sonnet:')),
);
// The literal is still allowed to appear in the registry that owns it (as the
// legacy pricing key) and inside comments. What must not come back is a call site
// naming it — so match executable lines outside src/lib/ai/models.ts.
const strayLegacyId = execSync(
  "grep -rn 'claude-sonnet-4-6' --include=*.ts --include=*.tsx src services || true",
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  .filter(line => !line.startsWith('src/lib/ai/models.ts:'))
  .filter(line => {
    const code = line.slice(line.indexOf(':', line.indexOf(':') + 1) + 1).trim();
    return !code.startsWith('//') && !code.startsWith('*') && !code.startsWith('/*');
  });
check(
  'no executable code still names claude-sonnet-4-6',
  strayLegacyId.length === 0,
  strayLegacyId.join('\n        '),
);

console.log('\n2. The retired id is still priceable (in-flight instances record real cost, not 0)');

// Imported rather than hardcoded so deleting the legacy entry fails here loudly.
const { anthropicCostUsd } = require('../src/lib/ai/cost') as typeof import('../src/lib/ai/cost');
const usage = { input_tokens: 1_000_000, output_tokens: 0 };
check(
  `${LEGACY_MODEL_IDS.sonnet46} still resolves a non-zero rate`,
  anthropicCostUsd(LEGACY_MODEL_IDS.sonnet46, usage) > 0,
  String(anthropicCostUsd(LEGACY_MODEL_IDS.sonnet46, usage)),
);
check(
  'Sonnet 5 and the id it replaced price identically (both list at $3/$15)',
  anthropicCostUsd(MODELS.sonnet, usage) === anthropicCostUsd(LEGACY_MODEL_IDS.sonnet46, usage),
);

console.log('\n3. Every Sonnet call site obeys the Sonnet 5 request surface');

const files = execSync(
  "grep -rl 'MODELS\\.sonnet' --include=*.ts --include=*.tsx src services",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean);

const missingThinking: string[] = [];
const strandedSampling: string[] = [];
let callSites = 0;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!SONNET_MODEL_LINE.test(lines[i])) continue;
    callSites++;

    // Walk the object literal that owns this `model:` line. Both properties are
    // checked over the whole literal rather than at a fixed offset — a comment
    // between `model:` and `thinking:` is style, not a compliance failure.
    let depth = 0;
    let hasThinking = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (depth === 0 && SAMPLING_LINE.test(lines[j])) strandedSampling.push(`${file}:${j + 1}`);
      if (depth === 0 && THINKING_LINE.test(lines[j])) hasThinking = true;
      for (const ch of lines[j]) {
        if (ch === '{' || ch === '[' || ch === '(') depth++;
        else if (ch === '}' || ch === ']' || ch === ')') depth--;
      }
      if (depth < 0) break;
    }
    if (!hasThinking) missingThinking.push(`${file}:${i + 1}`);
  }
}

check('found the Sonnet call sites to check', callSites > 50, `found ${callSites}`);
check(
  `no Sonnet call passes temperature/top_p/top_k (${callSites} sites)`,
  strandedSampling.length === 0,
  strandedSampling.join('\n        '),
);
check(
  `every Sonnet call passes thinking explicitly (${callSites} sites)`,
  missingThinking.length === 0,
  missingThinking.join('\n        '),
);

console.log('\n4. Haiku is untouched — it still accepts what Sonnet 5 rejects');

const draft = readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');
check(
  'the Haiku sentence-opener call keeps its temperature',
  /model: MODELS\.haiku,\n\s*temperature: 0\.6,/.test(draft),
);

console.log(
  failures === 0
    ? `\nAll Sonnet 5 compliance checks passed (${callSites} call sites).\n`
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
