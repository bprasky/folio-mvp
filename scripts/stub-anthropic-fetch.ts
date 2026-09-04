/**
 * Stub the Anthropic Messages API for static checks. Import this FIRST.
 *
 * Why it is a module and not three lines at the top of the check script: tsx
 * compiles to CommonJS through esbuild, which hoists every `require` above the
 * file's other statements. A `globalThis.fetch = …` written above the imports
 * therefore runs AFTER the imported modules have been evaluated — and
 * `selectPullQuotes` constructs its Anthropic client at module scope, capturing
 * `globalThis.fetch` right then (`options.fetch ?? getDefaultFetch()`). The stub
 * would be installed too late, the client would hold the real fetch, and every
 * ranking assertion would quietly exercise the offline fallback instead of the
 * path it exists to test — passing while testing nothing.
 *
 * Import order among the hoisted requires IS preserved, so a side-effecting
 * module listed first runs before the modules that construct clients. That is
 * the only reliable hook available here.
 *
 * The same hoisting is why the API key is set here rather than in the caller.
 */

process.env.ANTHROPIC_API_KEY ||= 'sk-ant-placeholder-for-static-checks';

/** What the stubbed ranker returns next. Set per assertion. */
let rankerReply = '{}';

export function setRankerReply(json: string): void {
  rankerReply = json;
}

/** Set by the stub so a check can assert the model was actually consulted. */
export const calls = { ranker: 0 };

/** The prompt body the ranker was last sent, for asserting what it receives. */
export let lastRankerPrompt = '';

globalThis.fetch = (async (_url: unknown, init: { body?: string }) => {
  const body = JSON.parse(init?.body ?? '{}');
  const system = typeof body.system === 'string' ? body.system : '';

  // Any other outbound request from a static check is a bug in the check.
  if (!system.includes('choosing the single pull quote')) {
    throw new Error('stub-anthropic-fetch: unexpected outbound request');
  }

  calls.ranker++;
  lastRankerPrompt = body.messages?.[0]?.content ?? '';

  // `usage` is deliberately omitted: callLLM only records a CostEvent when the
  // response carries usage.input_tokens, and recording one would reach for a
  // database a static check has no business needing.
  return new Response(
    JSON.stringify({
      id: 'msg_stub',
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [{ type: 'text', text: rankerReply }],
      stop_reason: 'end_turn',
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}) as unknown as typeof fetch;
