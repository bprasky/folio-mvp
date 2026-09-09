import { createServer } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Isolation } from './isolation.mjs';
import { RenderError, validateUrl, validateResult, trustedResolver } from './policy.mjs';

const digest = value => createHash('sha256').update(value).digest();
export function authorized(header, keys) {
  const candidate = digest(typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '');
  let matches = 0;
  for (const key of keys) matches |= Number(timingSafeEqual(candidate, digest(key)));
  return matches !== 0;
}
export function createController({ keys, isolation, resolver, log = value => console.info(JSON.stringify(value)) }) {
  if (!keys.length || keys.length > 2 || keys.some(k => typeof k !== 'string' || k.length < 32)) throw new RenderError('isolation_setup_failure');
  let busy = false;
  const server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Connection: 'close' }); res.end(JSON.stringify(value)); };
    if (req.method !== 'POST' || req.url !== '/render') return send(404, { error: 'not_found' });
    if (!authorized(req.headers.authorization, keys)) return send(401, { error: 'unauthorized' });
    if (busy) return send(503, { error: 'busy' });
    busy = true;
    const start = Date.now(); let outcome = 'success';
    try {
      if (req.headers['content-type']?.split(';')[0] !== 'application/json' || req.headers['transfer-encoding'] || !/^\d+$/.test(req.headers['content-length'] || '') || Number(req.headers['content-length']) > 8192) throw new RenderError('invalid_url');
      const chunks = []; let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 8192) throw new RenderError('invalid_url');
        chunks.push(chunk);
      }
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RenderError('invalid_url'); }
      if (!data || Array.isArray(data) || Object.keys(data).join(',') !== 'url') throw new RenderError('invalid_url');
      const url = await validateUrl(data.url, resolver);
      const result = validateResult(await isolation.render(url));
      await validateUrl(result.finalUrl, resolver);
      send(200, result);
    } catch (error) {
      outcome = error instanceof RenderError ? error.code : 'internal_worker_error';
      send(outcome === 'invalid_url' ? 400 : outcome === 'forbidden_destination' ? 422 : 503, { error: outcome });
    } finally {
      busy = false;
      log({ component: 'render', outcome, durationMs: Date.now() - start });
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.timeout = 75000;
  server.maxConnections = 16;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const dns = process.env.RENDER_DNS_IPV4 || '1.1.1.1';
    const isolation = new Isolation({ dns, image: process.env.RENDER_IMAGE_ID || '', blocked: (process.env.RENDER_BLOCKED_IPV4 || '').split(',').filter(Boolean), seccomp: resolve('seccomp.json'), resolv: '/run/folio-render/resolv.conf' });
    await isolation.initialize();
    const keys = [process.env.RENDER_API_KEY, process.env.RENDER_API_KEY_PREVIOUS].filter(Boolean);
    const server = createController({ keys, isolation, resolver: trustedResolver(dns) });
    server.listen(8787, '127.0.0.1'); // TLS termination is the only externally exposed endpoint.
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { server.close(); setTimeout(() => process.exit(0), 60000).unref(); });
  } catch { console.error(JSON.stringify({ component: 'render', outcome: 'isolation_setup_failure' })); process.exitCode = 1; }
}
