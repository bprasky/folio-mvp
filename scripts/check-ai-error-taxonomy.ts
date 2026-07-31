/**
 * Guards the AI failure taxonomy.
 *
 * The property that matters: a code marked non-retryable must never be paired
 * with copy that invites a retry. That pairing is what the La Gorce failure cost
 * — the article failed identically at two temperatures and the designer was told
 * "Try regenerating." Copy and classification drift apart silently, so they get
 * asserted together.
 *
 * Run: npm run check:ai-errors
 */
process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

import { readFileSync } from 'fs';
import {
  AI_ERRORS,
  type AiErrorCode,
  codeFromTransport,
  isRetryable,
  needsReview,
  statusFor,
  userMessageFor,
} from '../src/lib/ai/errors';

let failures = 0;
const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.error(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const codes = Object.keys(AI_ERRORS) as AiErrorCode[];

console.log('\n1. Non-retryable copy never invites another attempt');

// The exact phrasings that cost money. "Contact support" is fine; "try again" is not.
const RETRY_BAIT = /\b(try again|try regenerat\w*|regenerate|retry|run it again|attempt again)\b/i;
for (const code of codes) {
  if (isRetryable(code)) continue;
  const msg = userMessageFor(code);
  // "no need to run it again" is the opposite of bait — allow the negated form.
  const stripped = msg.replace(/\bno need to (run it again|try again)\b/gi, '');
  check(`${code} does not tell the designer to retry`, !RETRY_BAIT.test(stripped), msg);
}

console.log('\n2. Every code is completely specified');
for (const code of codes) {
  const s = AI_ERRORS[code];
  check(`${code} has usable copy`, s.userMessage.length > 20);
  check(`${code} has a 4xx/5xx status`, s.status >= 400 && s.status < 600, String(s.status));
  check(`${code} cooldown is non-negative`, s.cooldownMs >= 0);
}

console.log('\n3. Retryable and deterministic classes stay coherent');
// A retryable failure resolves itself; suppressing it would block work that
// would have succeeded — the opposite of the "never degrade UX" rule.
for (const code of codes) {
  if (isRetryable(code)) {
    check(`${code} (retryable) has no cooldown`, AI_ERRORS[code].cooldownMs === 0);
    check(`${code} (retryable) does not demand review`, !needsReview(code));
  }
}
// Anything a retry cannot fix has to reach a human, or it is silently swallowed.
for (const code of codes) {
  if (!isRetryable(code)) check(`${code} (non-retryable) is flagged for review`, needsReview(code));
}

console.log('\n4. The failures that actually happened are classified deterministic');
// Each of these reproduced or is structurally guaranteed to reproduce.
for (const code of ['LLM_JSON_PARSE', 'LLM_TRUNCATED', 'LLM_EMPTY_RESPONSE', 'LLM_REPAIR_FAILED'] as AiErrorCode[]) {
  check(`${code} is non-retryable`, !isRetryable(code));
  check(`${code} suppresses repeat calls on the same project`, AI_ERRORS[code].cooldownMs > 0);
}

console.log('\n5. Transport codes all land somewhere sensible');
for (const [transport, expected] of [
  ['rate_limited', 'LLM_RATE_LIMITED'],
  ['timeout', 'LLM_TIMEOUT'],
  ['auth_failed', 'LLM_AUTH_FAILED'],
  ['forbidden', 'LLM_AUTH_FAILED'],
  ['moderation_block', 'LLM_CONTENT_REFUSED'],
] as const) {
  check(`${transport} -> ${expected}`, codeFromTransport(transport) === expected, codeFromTransport(transport));
}
check('an unknown transport code degrades to a retryable call failure',
  codeFromTransport('something_new') === 'LLM_CALL_FAILED' && isRetryable('LLM_CALL_FAILED'));
check('a bad API key is NOT retryable (every retry is a wasted call)', !isRetryable('LLM_AUTH_FAILED'));

console.log('\n6. The generator and the route actually use it');
const draft = readFileSync('src/lib/posting/generateEditorialDraft.ts', 'utf8');
check('no hardcoded "Try regenerating" copy remains in the generator',
  !/Try regenerating/i.test(draft),
  (draft.match(/.*Try regenerating.*/i) || [])[0]);
check('throw sites take a code, not a hand-written message',
  !/new EditorialGenerationError\(\s*'[A-Z_]+',\s*'/.test(draft));
check('deterministic failures are reported for review', /reportIfReviewable\('LLM_JSON_PARSE'/.test(draft));
check('the reporter honors needsReview rather than logging everything',
  /needsReview\(code\)/.test(draft));

const route = readFileSync('src/app/api/posting/project/[projectId]/interview/generate/route.ts', 'utf8');
check('the route returns `retryable` so the UI can drop the retry control',
  /retryable: e\?\.retryable/.test(route));

console.log(failures === 0
  ? `\nAll AI error-taxonomy checks passed (${codes.length} codes).\n`
  : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
