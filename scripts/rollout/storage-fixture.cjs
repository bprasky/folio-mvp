// Disposable HTTP object store with actual files and Supabase-compatible storage
// requests. Policy implementation is synthetic; hosted Supabase remains a rollout check.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, createHmac, randomUUID } = require('node:crypto');

async function storageFixture(options = {}) {
  await fs.mkdir('.tmp', { recursive: true });
  const directory = await fs.mkdtemp(path.resolve('.tmp/rollout-storage-'));
  const objects = new Map(), buckets = new Map([['project-photos', false], ['event-images', true]]);
  const serviceKey = 'rollout-fixture-service-role', anonKey = 'rollout-fixture-anon';
  const signingKey = randomUUID();
  const events = []; let timeOffset = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fixture');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const admin = req.headers.authorization === `Bearer ${serviceKey}`;
    const json = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      if (options.redis && ['/pipeline', '/'].includes(url.pathname) && req.method === 'POST') {
        if (req.headers.authorization !== 'Bearer rollout-local-redis') return json({ error: 'Forbidden' }, 403);
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks));
        const run = async command => {
          const { stdout } = await require('node:util').promisify(require('node:child_process').execFile)('wsl', ['-d', 'docker-desktop', '--', 'chroot', '/tmp/folio-rollout-root', 'redis-cli', '-p', '55441', '--json', ...command.map(String)], { windowsHide: true });
          if (stdout.trim().startsWith('error:')) return { error: JSON.parse(stdout.trim().slice(6)) };
          const result = JSON.parse(stdout); if (result?.error) return { error: result.error };
          const encode = value => Array.isArray(value) ? value.map(encode) : typeof value === 'string' && value !== 'OK' ? Buffer.from(value).toString('base64') : value;
          return { result: req.headers['upstash-encoding'] === 'base64' ? encode(result) : result };
        };
        return json(url.pathname === '/pipeline' ? await Promise.all(body.map(run)) : await run(body));
      }
      if (url.pathname === '/v1/messages' && options.model) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        return json(await options.model(JSON.parse(Buffer.concat(chunks))));
      }
      if (url.pathname === '/v1/embeddings' && options.model) return json({ data: [{ embedding: Array(1536).fill(0), index: 0 }] });
      if (parts[0] !== 'storage' || parts[1] !== 'v1') return json({ error: 'Not found' }, 404);
      if (parts[2] === 'bucket') {
        if (!admin) return json({ error: 'Forbidden' }, 403);
        const name = parts[3];
        return buckets.has(name) ? json({ id: name, name, public: buckets.get(name), file_size_limit: 20971520 }) : json({ error: 'Bucket not found' }, 404);
      }
      if (parts[2] !== 'object') return json({ error: 'Not found' }, 404);
      let mode = 'authenticated', offset = 3;
      if (['public', 'authenticated', 'sign'].includes(parts[3])) { mode = parts[3]; offset = 4; }
      const bucket = parts[offset], object = parts.slice(offset + 1).join('/'), key = `${bucket}/${object}`;
      const file = path.join(directory, createHash('sha256').update(key).digest('hex'));
      events.push({ method: req.method, mode, key, admin });
      if (!buckets.has(bucket) || !object) return json({ error: 'Not found' }, 404);
      if (mode === 'sign' && req.method === 'POST') {
        if (!admin) return json({ error: 'Forbidden' }, 403);
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const expires = Date.now() + timeOffset + JSON.parse(Buffer.concat(chunks)).expiresIn * 1000;
        const value = Buffer.from(JSON.stringify({ key, expires })).toString('base64url');
        const token = value + '.' + createHmac('sha256', signingKey).update(value).digest('hex');
        return json({ signedURL: `/object/sign/${key}?token=${token}` });
      }
      if (req.method === 'POST') {
        if (!admin) return json({ error: 'Forbidden', statusCode: '403' }, 403);
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 20971520) return json({ error: 'Too large' }, 413); chunks.push(chunk); }
        try { await fs.writeFile(file, Buffer.concat(chunks), { flag: 'wx' }); }
        catch (error) { if (error.code === 'EEXIST') return json({ error: 'Duplicate', statusCode: '409', message: 'Already exists' }, 409); throw error; }
        objects.set(key, { file, mime: req.headers['content-type'] || 'image/jpeg' });
        return json({ Key: key, Id: randomUUID(), path: object });
      }
      let signed = false;
      if (mode === 'sign') {
        const [value, signature] = (url.searchParams.get('token') || '').split('.');
        if (value && signature === createHmac('sha256', signingKey).update(value).digest('hex')) {
          const claim = JSON.parse(Buffer.from(value, 'base64url')); signed = claim.key === key && claim.expires > Date.now() + timeOffset;
        }
      }
      if (!(admin || signed || (mode === 'public' && buckets.get(bucket)))) return json({ error: 'Not found' }, 404);
      const stored = objects.get(key); if (!stored) return json({ error: 'Not found' }, 404);
      const bytes = await fs.readFile(stored.file);
      res.writeHead(200, { 'Content-Type': stored.mime, 'Content-Length': bytes.length, 'Cache-Control': 'no-store' }); res.end(bytes);
    } catch (error) { json({ error: error.message }, 500); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port || 0, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, serviceKey, anonKey, buckets, objects, events, directory,
    advanceTime: ms => { timeOffset += ms; },
    close: async () => { await new Promise(resolve => server.close(resolve)); } };
}
module.exports = { storageFixture };
