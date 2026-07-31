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

import { MODELS, MODEL_FOR, LEGACY_MODEL_IDS } from '../src/lib/ai/models';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
  }
}

// Which MODEL_FOR task classes currently resolve to Sonnet. Computed from the
// registry rather than hardcoded, so moving a class between tiers automatically
// moves its call sites in or out of the Sonnet-rules set — flip `extraction`
// back to Sonnet and those files start being checked again on the next run.
const SONNET_TASKS = (Object.keys(MODEL_FOR) as Array<keyof typeof MODEL_FOR>)
  .filter(task => MODEL_FOR[task] === MODELS.sonnet);

const SONNET_MODEL_LINE = new RegExp(
  `^\\s*model:\\s*(MODELS\\.sonnet|modelName${SONNET_TASKS.map(t => `|MODEL_FOR\\.${t}`).join('')}),?\\s*$`,
);
const SAMPLING_LINE = /^\s*(temperature|top_p|top_k)\s*:/;
// Two compliant forms: the inline literal, or the spread from lib/ai/thinking,
// which resolves to `disabled` unless the surface is flagged on. Note `enabled`
// is deliberately NOT accepted — it carries budget_tokens, which Sonnet 5 rejects.
const THINKING_LINE = /thinking:\s*\{\s*type:\s*['"](disabled|adaptive)['"]|\.\.\.thinkingParams\(/;

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

console.log('\n4. Adaptive thinking is opt-in, and opting in resizes the budget');

// Imported lazily so the env reads below happen after we control the env.
delete process.env.ADAPTIVE_THINKING_SURFACES;
delete process.env.ADAPTIVE_THINKING_EFFORT;
const { thinkingSettingsFor, thinkingParams } =
  require('../src/lib/ai/thinking') as typeof import('../src/lib/ai/thinking');

const offEditorial = thinkingSettingsFor('editorial');
check('unset flag leaves editorial on thinking:disabled', offEditorial.thinking.type === 'disabled', JSON.stringify(offEditorial.thinking));
check('unset flag leaves followups on thinking:disabled', thinkingSettingsFor('followups').thinking.type === 'disabled');
check('disabled carries no effort and no budget change', offEditorial.maxTokensMultiplier === 1 && offEditorial.output_config === undefined);
check('disabled emits only `thinking` to the API', JSON.stringify(thinkingParams(offEditorial)) === '{"thinking":{"type":"disabled"}}', JSON.stringify(thinkingParams(offEditorial)));

process.env.ADAPTIVE_THINKING_SURFACES = 'editorial';
const onEditorial = thinkingSettingsFor('editorial');
check('flagging one surface turns only that surface adaptive', onEditorial.thinking.type === 'adaptive' && thinkingSettingsFor('followups').thinking.type === 'disabled');
check('adaptive defaults to low effort, not Sonnet 5’s high', onEditorial.output_config?.effort === 'low', String(onEditorial.output_config?.effort));
check('adaptive raises the max_tokens budget (thinking shares it)', onEditorial.maxTokensMultiplier > 1, String(onEditorial.maxTokensMultiplier));

process.env.ADAPTIVE_THINKING_SURFACES = 'editorial,followups';
check('both surfaces can be enabled together', thinkingSettingsFor('editorial').adaptive && thinkingSettingsFor('followups').adaptive);

process.env.ADAPTIVE_THINKING_EFFORT = 'medium';
check('effort is configurable', thinkingSettingsFor('editorial').output_config?.effort === 'medium');
process.env.ADAPTIVE_THINKING_EFFORT = 'banana';
check('an invalid effort falls back to low rather than reaching the API', thinkingSettingsFor('editorial').output_config?.effort === 'low');

process.env.ADAPTIVE_THINKING_SURFACES = 'Editorial ';
check('surface matching tolerates case and whitespace', thinkingSettingsFor('editorial').adaptive);
process.env.ADAPTIVE_THINKING_SURFACES = 'editorials';
check('a near-miss surface name does NOT enable anything', !thinkingSettingsFor('editorial').adaptive);

delete process.env.ADAPTIVE_THINKING_SURFACES;
delete process.env.ADAPTIVE_THINKING_EFFORT;

console.log('\n5. Responses are read by block type, not by index');

// The trap this guards: with thinking on, `content` is [thinking, text]. Code
// doing `content[0]?.type === 'text' ? … : ''` gets the fallback — an empty
// article (LLM_EMPTY_RESPONSE) or zero follow-ups — with no error raised. It is
// invisible until the flag is flipped, so it is asserted rather than reviewed.
const { firstTextBlock } = require('../src/lib/ai/thinking') as typeof import('../src/lib/ai/thinking');

const thinkingFirst = { content: [{ type: 'thinking', thinking: 'weighing the lead…' }, { type: 'text', text: '{"ok":1}' }] };
const textOnly = { content: [{ type: 'text', text: '{"ok":1}' }] };

check('reads past a leading thinking block', firstTextBlock(thinkingFirst) === '{"ok":1}', firstTextBlock(thinkingFirst));
check('unchanged when thinking is off (text is block 0)', firstTextBlock(textOnly) === '{"ok":1}');
check('the old idiom would have silently returned nothing here',
  (thinkingFirst.content[0] as { type: string }).type !== 'text');
check('no text block yields empty string, not a throw', firstTextBlock({ content: [{ type: 'thinking', thinking: 'x' }] }) === '');
check('null/undefined message is safe', firstTextBlock(null) === '' && firstTextBlock(undefined) === '');

const indexReaders = execSync(
  "grep -rn \"content\\[0\\]\" --include=*.ts src/lib/posting/generateEditorialDraft.ts 'src/app/api/posting/project/[projectId]/interview/followups' || true",
  { encoding: 'utf8' },
).trim();
check(
  'no thinking-capable call site still indexes content[0]',
  indexReaders === '',
  indexReaders,
);

console.log('\n6. Model tiering keeps the product on Sonnet and only cheapens invisible work');

check('published prose stays on Sonnet', MODEL_FOR.prose === MODELS.sonnet, MODEL_FOR.prose);
check('interview question generation stays on Sonnet', MODEL_FOR.interview === MODELS.sonnet, MODEL_FOR.interview);
check('structured extraction runs on Haiku', MODEL_FOR.extraction === MODELS.haiku, MODEL_FOR.extraction);
check('tool-using extraction stays on Sonnet (Haiku tool-calling is weaker)', MODEL_FOR.toolExtraction === MODELS.sonnet);
check('vision COORDINATES stay on Sonnet (misplaced tags are user-visible)', MODEL_FOR.visionCoordinates === MODELS.sonnet);

// The tiering is only a saving if the cheap model is actually cheaper to run.
const perMTok = (m: string) => anthropicCostUsd(m, { input_tokens: 1_000_000, output_tokens: 1_000_000 });
check(
  'the extraction tier is materially cheaper than the prose tier',
  perMTok(MODEL_FOR.extraction) < perMTok(MODEL_FOR.prose) / 2,
  `extraction $${perMTok(MODEL_FOR.extraction)} vs prose $${perMTok(MODEL_FOR.prose)} per 1M in+out`,
);

// Every model the registry can hand out must be priceable, or CostEvent silently
// records 0 for a whole class of calls and the saving becomes unmeasurable.
const unpriced = [...new Set(Object.values(MODEL_FOR))].filter(m => perMTok(m) === 0);
check('every tier resolves a pricing rate', unpriced.length === 0, unpriced.join(', '));

console.log('\n7. Haiku is untouched — it still accepts what Sonnet 5 rejects');

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
