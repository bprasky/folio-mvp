import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from '../../src/lib/rateLimit';

test('rate-limit logs distinguish rejection, missing config, timeout and outage without identifiers', async () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN };
  process.env.NODE_ENV = 'production';
  const logs: string[] = [];
  const log = mock.method(console, 'warn', (...args) => logs.push(args.join(' ')));
  const config = { max: 2, windowMs: 60000 };
  try {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const missing = await checkRateLimit('sensitive-person@example.com', config);
    assert.equal(missing.success, false);
    assert.equal(missing.reason, 'missing_configuration');
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.invalid';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'sensitive-test-token';
    for (const mode of ['allowed', 'rejected', 'timeout', 'outage']) {
      const transport = mock.method(globalThis, 'fetch', async (_url, options) => {
        if (mode === 'outage') throw Error('sensitive-test-token');
        if (mode === 'timeout') return new Promise<Response>(() => {});
        const command = JSON.parse(String(options?.body));
        const response = { result: [mode === 'allowed' ? 1 : 3, 2] };
        return new Response(JSON.stringify(Array.isArray(command[0]) ? [response] : response));
      });
      try {
        const result = await checkRateLimit('sensitive-person@example.com', config);
        assert.equal(result.success, mode === 'allowed');
        assert.equal(result.reason, mode === 'allowed' ? undefined : mode === 'rejected' ? 'rejected' : `backend_${mode}`);
        assert.equal(JSON.stringify(result).includes('sensitive'), false);
        assert.equal(JSON.stringify(result).includes('example.invalid'), false);
      }
      finally { transport.mock.restore(); }
    }
    assert.deepEqual(logs.map(line => JSON.parse(line.slice(line.indexOf('{'))).outcome), ['missing_configuration', 'rejected', 'backend_timeout', 'backend_outage']);
    assert.equal(logs.join('').includes('sensitive'), false);
    assert.equal(logs.join('').includes('example.invalid'), false);
  } finally {
    log.mock.restore();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
