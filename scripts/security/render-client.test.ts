import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderProductPage } from '../../src/lib/server/render-product';

test('isolated renderer sends only URL and fixed authentication; validates bounded final URL/status', async () => {
  const previous = { url: process.env.RENDER_WORKER_URL, key: process.env.RENDER_WORKER_API_KEY };
  process.env.RENDER_WORKER_URL = 'https://worker.example/render';
  process.env.RENDER_WORKER_API_KEY = 'test-only-key-'.repeat(4);
  let calls = 0;
  const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://worker.example/render');
    assert.deepEqual(JSON.parse(init.body), { url: 'https://8.8.8.8/product' });
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, `Bearer ${process.env.RENDER_WORKER_API_KEY}`);
    return Response.json({ html: '<html>Chair</html>', status: 200, finalUrl: 'https://8.8.8.8/final' });
  });
  try {
    assert.equal((await renderProductPage('https://8.8.8.8/product'))?.finalUrl, 'https://8.8.8.8/final');
    process.env.RENDER_WORKER_URL = 'http://worker.example/render';
    await assert.rejects(renderProductPage('https://8.8.8.8/product'));
    assert.equal(calls, 1);
    process.env.RENDER_WORKER_URL = 'https://worker.example/render';
    fetchMock.mock.mockImplementation(async () => Response.json({ html: '', status: 200, finalUrl: 'http://127.0.0.1' }));
    await assert.rejects(renderProductPage('https://8.8.8.8/product'));
    fetchMock.mock.mockImplementation(async () => Response.json({ html: 'x'.repeat(5 * 1024 * 1024 + 1), status: 200, finalUrl: 'https://8.8.8.8' }));
    await assert.rejects(renderProductPage('https://8.8.8.8/product'));
    fetchMock.mock.mockImplementation(async () => { throw Error('https://endpoint-containing-secret'); });
    await assert.rejects(renderProductPage('https://8.8.8.8/product'), e => e instanceof Error && e.message === 'Protected renderer unavailable');
    delete process.env.RENDER_WORKER_API_KEY;
    assert.equal(await renderProductPage('https://8.8.8.8/product'), null);
  } finally {
    fetchMock.mock.restore();
    if (previous.url === undefined) delete process.env.RENDER_WORKER_URL; else process.env.RENDER_WORKER_URL = previous.url;
    if (previous.key === undefined) delete process.env.RENDER_WORKER_API_KEY; else process.env.RENDER_WORKER_API_KEY = previous.key;
  }
});
