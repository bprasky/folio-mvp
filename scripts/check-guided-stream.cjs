// Native Web Streams and actual transport/parser; no network, credentials or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let fakeFetch;
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, console, process: { env: {} }, AbortController, TextDecoder, setTimeout, clearTimeout,
    fetch: (...args) => fakeFetch(...args), require(name) {
      if (name === '@/lib/ai/cost') return { recordCostEvent: () => { throw Error('Unexpected cost write'); } };
      if (name.startsWith('@/')) return load(path.join('src', name.slice(2)) + '.ts');
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    },
  }, { filename: file });
  return exports;
}
const { parseReaction } = load('src/lib/interview/guided/reaction.ts');
const { sendGuidedCommand } = load('src/components/posting/interview/guidedTransport.ts');
const answer = 'We kept the original walls and put most of the budget into lighting.';
const parse = (text, quote = answer) => parseReaction(JSON.stringify({ text, quote }), answer);
const command = { action: 'answer', version: 1, requestId: 'same-receipt', text: answer };
const session = { id: 'session', version: 2, requestIds: ['same-receipt'] };
const eventResponse = events => new Response(events.map(event => JSON.stringify(event)).join('\n') + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } });

async function main() {
  assert.equal(parse('You kept the walls and made lighting the main investment.'), 'You kept the walls and made lighting the main investment.');
  for (const [text, quote] of [
    ['Why lighting?', answer], ['Tell me more about the walls.', answer], ['You kept the walls, right.', answer],
    ['You kept the walls…', answer], ['You kept the walls', answer], ['Kept the walls.', 'invented quote'], ['', ''],
  ]) assert.equal(parse(text, quote), null);
  assert.throws(() => parseReaction('not JSON', answer));
  console.log('PASS observation parser rejects questions, invitations, unfinished text and unavailable evidence');

  const events = [{ type: 'saved', session }, { type: 'reaction', sessionId: 'session', version: 2, turnId: 'turn', text: 'The café kept its walls.' }, { type: 'complete', session }];
  const bytes = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + '\n');
  fakeFetch = async (_, init) => {
    assert.equal(init.headers.Accept, 'application/x-ndjson'); assert.deepEqual(JSON.parse(init.body), command);
    return new Response(new ReadableStream({ start(controller) {
      // Deliberately split multibyte Unicode and JSON across network chunks.
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close();
    } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  };
  const received = [];
  assert.equal((await sendGuidedCommand('/private', command, event => received.push(event))).session.version, 2);
  assert.equal(JSON.stringify(received), JSON.stringify(events.slice(0, 2)));
  console.log('PASS incremental transport preserves Unicode and reports progress before its terminal result');

  fakeFetch = async () => eventResponse(events.slice(0, 1));
  const accepted = [];
  await assert.rejects(sendGuidedCommand('/private', command, event => accepted.push(event)), /interrupted/);
  assert.equal(accepted[0].type, 'saved');
  fakeFetch = async () => eventResponse([{ type: 'error', status: 409, message: 'Newer answer saved.' }]);
  assert.equal((await sendGuidedCommand('/private', command, () => {})).status, 409);
  fakeFetch = async () => Response.json({ session });
  assert.equal((await sendGuidedCommand('/private', command, () => {})).session.version, 2);
  fakeFetch = async () => Response.json({}, { status: 401 });
  await assert.rejects(sendGuidedCommand('/private', command, () => {}), /session expired/);
  console.log('PASS interrupted saved responses stay uncertain; stream conflicts, JSON compatibility and expired login remain visible');

  let calls = 0;
  fakeFetch = async (_, { signal }) => {
    calls++;
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(events[0]) + '\n'));
      signal.addEventListener('abort', () => controller.error(new Error('Aborted')));
    } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  };
  await assert.rejects(sendGuidedCommand('/private', command, () => {}, 20), /timed out/);
  assert.equal(calls, 1);
  console.log('PASS a stalled response body times out without automatically resubmitting the answer');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
