import { test, mock } from 'node:test';
import dns from 'node:dns/promises';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import assert from 'node:assert/strict';
import { Webhook } from 'svix';
import { verifyInbound, InboundVerificationError } from '../../src/lib/email/verify-inbound';
import { parseProductUrl, validateProductUrl, isPublicAddress, safeProductFetch } from '../../src/lib/server/safe-product-url';
import { checkRateLimit, checkMultipleRateLimits } from '../../src/lib/rateLimit';

test('webhook: signed test events verify, tampering and missing signatures fail', () => {
  const secret = `whsec_${Buffer.from('a-test-only-secret-with-32-bytes!!').toString('base64')}`;
  const verifier = new Webhook(secret);
  const raw = '{"type":"email.test"}';
  const now = new Date();
  const headers = new Headers({ 'svix-id': 'test-id', 'svix-timestamp': String(Math.floor(+now / 1000)), 'svix-signature': verifier.sign('test-id', now, raw) });
  assert.deepEqual(verifyInbound(raw, headers, secret), { type: 'email.test' });
  assert.throws(() => verifyInbound(raw + ' ', headers, secret), InboundVerificationError);
  for (const header of ['svix-id', 'svix-timestamp', 'svix-signature']) {
    const missing = new Headers(headers); missing.delete(header);
    assert.throws(() => verifyInbound(raw, missing, secret), InboundVerificationError);
  }
  assert.throws(() => verifyInbound(raw, headers, ''), (e: InboundVerificationError) => e.status === 503);
  const old = new Date(Date.now() - 600000);
  headers.set('svix-timestamp', String(Math.floor(+old / 1000)));
  headers.set('svix-signature', verifier.sign('test-id', old, raw));
  assert.throws(() => verifyInbound(raw, headers, secret), InboundVerificationError);
});

test('URL policy blocks non-public IPv4, IPv6, alternate encodings and credentials', () => {
  for (const url of ['http://localhost', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://10.0.0.1', 'http://172.16.0.1', 'http://192.168.1.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://[fc00::1]', 'http://[fe80::1]', 'file:///etc/passwd', 'https://user:pass@example.com']) {
    assert.throws(() => parseProductUrl(url), url);
  }
  for (const address of ['0.0.0.0', '100.64.0.1', '224.0.0.1', '::', 'ff02::1']) assert.equal(isPublicAddress(address), false);
  assert.equal(parseProductUrl('https://example.com/product').pathname, '/product');
  assert.equal(isPublicAddress('8.8.8.8'), true);
});


test('DNS policy rejects mixed public/private answers and resolution failures', async () => {
  const resolver = (async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]) as never;
  await assert.rejects(validateProductUrl('https://example.com', resolver));
  await assert.rejects(validateProductUrl('https://example.com', (async () => { throw Error('DNS'); }) as never));
});

test('transport pins the public DNS answer instead of resolving again at connection time', async () => {
  let lookups = 0;
  const dnsMock = mock.method(dns, 'lookup', async () => {
    lookups++;
    return [{ address: lookups === 1 ? '8.8.8.8' : '127.0.0.1', family: 4 }];
  });
  const requestMock = mock.method(https, 'request', (_url, options, callback) => {
    options.lookup('shop.example', {}, (error, address, family) => {
      assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4);
    });
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      const res = Object.assign(new PassThrough(), { statusCode: 200, headers: {} });
      callback(res); res.end('product'); queueMicrotask(() => req.emit('close'));
    };
    return req;
  });
  try {
    assert.equal((await safeProductFetch('https://shop.example/product')).html, 'product');
    assert.equal(lookups, 1);
  } finally { dnsMock.mock.restore(); requestMock.mock.restore(); }
});

test('public redirect into a private network is rejected before a second connection', async () => {
  const dnsMock = mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  let connections = 0;
  const requestMock = mock.method(https, 'request', (_url, _options, callback) => {
    connections++;
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      callback(Object.assign(new PassThrough(), { statusCode: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } }));
      queueMicrotask(() => req.emit('close'));
    };
    return req;
  });
  try {
    await assert.rejects(safeProductFetch('https://shop.example/product'));
    assert.equal(connections, 1);
  } finally { dnsMock.mock.restore(); requestMock.mock.restore(); }
});

test('local limits: allow, block, exact reset, and no double-counting', async () => {
  const previous = process.env.NODE_ENV;
  const originalNow = Date.now;
  process.env.NODE_ENV = 'test';
  let now = 1000; Date.now = () => now;
  try {
    const config = { max: 2, windowMs: 100 };
    assert.equal((await checkRateLimit('test-local', config)).success, true);
    assert.equal((await checkRateLimit('test-local', config)).remaining, 0);
    assert.equal((await checkRateLimit('test-local', config)).success, false);
    now += 100;
    assert.equal((await checkRateLimit('test-local', config)).success, true);
    assert.equal((await checkMultipleRateLimits([{ identifier: 'multi', config }])).remaining, 1);
    assert.equal((await checkRateLimit('multi', config)).success, true);
  } finally { Date.now = originalNow; process.env.NODE_ENV = previous; }
});

test('production never falls back to local limits without backend configuration', async () => {
  const previous = process.env.NODE_ENV;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  process.env.NODE_ENV = 'production';
  delete process.env.UPSTASH_REDIS_REST_URL;
  try { assert.equal((await checkRateLimit('prod', { max: 10, windowMs: 1000 })).success, false); }
  finally { process.env.NODE_ENV = previous; if (url !== undefined) process.env.UPSTASH_REDIS_REST_URL = url; }
});

test('production backend transport failure denies requests', async () => {
  const previous = { node: process.env.NODE_ENV, url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  const originalFetch = globalThis.fetch;
  process.env.NODE_ENV = 'production';
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
  globalThis.fetch = async () => { throw new Error('simulated transport outage'); };
  try {
    assert.equal((await checkRateLimit('backend-outage', { max: 10, windowMs: 1000 })).success, false);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({ NODE_ENV: previous.node, UPSTASH_REDIS_REST_URL: previous.url, UPSTASH_REDIS_REST_TOKEN: previous.token })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
