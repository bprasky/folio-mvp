import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('scripts/security/render-legacy.test.ts'));
function replace(name: string, exports: unknown) {
  const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeJS.Module;
}
let session = null; let allowed = true; let renders = 0;
replace('../../src/lib/auth', { auth: async () => session });
replace('../../src/lib/rateLimit', { rateLimit: async () => ({ ok: allowed }) });
replace('../../src/lib/server/render-product', { hasRenderWorker: () => true, renderProductPage: async () => { renders++; return { html: '<html>product</html>', status: 200, finalUrl: 'https://example.com' }; } });
const { getContent, bql } = require('../../src/lib/browserless/client');
test('all legacy rendering adapters authenticate and budget before worker use; BQL flags cannot add a provider fallback', async () => {
  assert.equal((await getContent('https://example.com')).status, 401);
  assert.equal(renders, 0);
  session = { user: { id: 'fixture-user' } };
  allowed = false;
  assert.equal((await bql('https://example.com', { proxy: 'residential' })).status, 429);
  assert.equal(renders, 0);
  allowed = true;
  assert.equal((await bql('https://example.com', { stealth: true, solveCaptchas: true })).ok, true);
  assert.equal(renders, 1);
});
