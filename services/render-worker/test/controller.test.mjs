import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createController, authorized } from '../controller.mjs';
import { RenderError } from '../policy.mjs';

const key = 'unit-only-'.repeat(5);
const resolver = { resolve4: async () => ['8.8.8.8'], resolve6: async () => [] };
async function fixture(fn, renderer = async () => ({ html: '<html>fixture</html>', status: 200, finalUrl: 'https://example.com/final' })) {
  const logs = []; let jobs = 0;
  const server = createController({ keys: [key], resolver, isolation: { render: async url => { jobs++; return renderer(url); } }, log: x => logs.push(x) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const send = (data, auth = key) => fetch(`http://127.0.0.1:${server.address().port}/render`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` }, body: JSON.stringify(data) });
  try { await fn({ send, jobs: () => jobs, logs }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('constant-size secret comparison accepts current/previous key only', () => {
  assert.equal(authorized('Bearer old', ['current', 'old']), true);
  assert.equal(authorized('Bearer attacker', ['current', 'old']), false);
  assert.equal(authorized(undefined, ['current']), false);
});
test('HTTP auth, extra properties, malformed/private URLs all fail before launch', async () => {
  await fixture(async ({ send, jobs }) => {
    assert.equal((await send({ url: 'https://example.com' }, 'bad')).status, 401);
    for (const data of [null, [], { url: 'file:///etc/passwd' }, { url: 'http://127.1' }, { url: 'https://example.com', javascript: 'anything' }, { url: 'https://example.com', proxy: 'http://proxy' }]) assert.ok((await send(data)).status >= 400);
    assert.equal(jobs(), 0);
  });
});
test('HTTP result is bounded and operational errors never include exception details', async () => {
  await fixture(async ({ send, logs }) => {
    const res = await send({ url: 'https://example.com' });
    assert.equal(res.status, 200); assert.equal((await res.json()).finalUrl, 'https://example.com/final');
    assert.equal(logs[0].outcome, 'success');
  });
  await fixture(async ({ send, logs }) => {
    const res = await send({ url: 'https://example.com' });
    assert.deepEqual(await res.json(), { error: 'isolation_setup_failure' });
    assert.ok(!JSON.stringify(logs).includes('example.com'));
  }, async () => { throw new RenderError('isolation_setup_failure'); });
});
test('controller rejects concurrent work rather than queuing unbounded browsers', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  await fixture(async ({ send, jobs }) => {
    const first = send({ url: 'https://example.com' });
    while (!jobs()) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await send({ url: 'https://example.com' })).status, 503);
    release(); assert.equal((await first).status, 200);
  }, async () => { await wait; return { html: '', status: 200, finalUrl: 'https://example.com' }; });
});
