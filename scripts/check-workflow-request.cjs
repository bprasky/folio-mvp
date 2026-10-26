// Real transport with controlled fetch failures; no external network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function transport(fetch) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/client/workflowRequest.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, fetch, AbortController, Response, setTimeout, clearTimeout });
  return exports.workflowRequest;
}
test('stalled headers time out, abort and never retry', async () => {
  let calls = 0, signal;
  const request = transport((_, init) => { calls++; signal = init.signal; return new Promise(() => {}); });
  await assert.rejects(request('/fixture', {}, 10), /not confirmed/);
  assert.equal(calls, 1); assert.equal(signal.aborted, true);
});
test('stalled body also times out and late completion cannot acknowledge success', async () => {
  let finish;
  const request = transport(async () => ({ status: 200, headers: {}, text: () => new Promise(resolve => { finish = resolve; }) }));
  await assert.rejects(request('/fixture', {}, 10), /timed out/);
  finish('{"saved":true}');
});
test('session expiry gives a recovery action', async () => {
  await assert.rejects(transport(async () => Response.json({ error: 'Unauthorized' }, { status: 401 }))('/fixture'), /Sign in again/);
});
test('server errors stay errors and successful bodies remain readable', async () => {
  const failed = await transport(async () => new Response('Unavailable', { status: 503 }))('/fixture');
  assert.equal(failed.ok, false); assert.equal(await failed.text(), 'Unavailable');
  const saved = await transport(async () => Response.json({ id: 'saved' }))('/fixture');
  assert.deepEqual(await saved.json(), { id: 'saved' });
});
