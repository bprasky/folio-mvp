// DEPLOY ONLY ON A DEDICATED PUBLIC TEST HOST/DOMAIN. No Folio data or credentials.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dgram from 'node:dgram';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';

export const product = { '@context': 'https://schema.org', '@type': 'Product', name: 'Acceptance Oak Chair', image: '/chair.svg', description: 'A controlled solid oak chair fixture.', offers: { '@type': 'Offer', price: '249.00', priceCurrency: 'USD' } };
export function fixtureResponse(path, target, origin) {
  const safeTarget = JSON.stringify(target).replace(/</g, '\\u003c');
  if (path === '/chair.svg') return { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="tan"/></svg>' };
  if (path === '/static') return { body: `<html><head><script type="application/ld+json">${JSON.stringify(product)}</script></head><body><h1>${product.name}</h1></body></html>` };
  if (path === '/hydrated') return { body: `<html><head></head><body><div id="app"></div><script>setTimeout(()=>{const s=document.createElement('script');s.type='application/ld+json';s.textContent=${JSON.stringify(JSON.stringify(product))};document.head.append(s);document.querySelector('#app').textContent='${product.name}'},300)</script></body></html>` };
  if (path === '/runtime-data') return { type: 'application/json', body: JSON.stringify(product) };
  if (path === '/browser-required') return { body: `<html><head></head><body><script>fetch('/runtime-data').then(r=>r.json()).then(product=>{const s=document.createElement('script');s.type='application/ld+json';s.textContent=JSON.stringify(product);document.head.append(s);document.body.append(product.name)})</script></body></html>` };
  if (path === '/redirect-product') return { status: 302, location: '/hydrated', body: '' };
  if (path === '/redirect') return { status: 302, location: target, body: '' };
  if (path === '/worker.js') return { type: 'application/javascript', body: `fetch(${safeTarget}).catch(()=>{});postMessage('attempted')` };
  if (path === '/sw.js') return { type: 'application/javascript', body: `self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(fetch(${safeTarget}).catch(()=>{}))});self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>{fetch(${safeTarget}).catch(()=>{});e.source?.postMessage('attempted')})` };
  const mechanism = path.slice(1);
  const code = {
    img: `const el=new Image();el.src=t;document.body.append(el);`,
    script: `const el=document.createElement('script');el.src=t;document.body.append(el);`,
    css_font: `const s=document.createElement('style');s.textContent='@import url('+t+');@font-face{font-family:probe;src:url('+t+'font)}body{font-family:probe;background-image:url('+t+'image)}';document.head.append(s);document.body.append('font witness');`,
    fetch_xhr: `fetch(t).catch(()=>{});const x=new XMLHttpRequest();x.open('GET',t+'xhr');x.send();`,
    iframe: `const el=document.createElement('iframe');el.src=t;document.body.append(el);`,
    websocket: `new WebSocket(t.replace('http:','ws:'));`,
    worker: `await new Promise((resolve,reject)=>{const w=new Worker('/worker.js?target='+encodeURIComponent(t));w.onmessage=resolve;w.onerror=reject});`,
    service_worker: `await navigator.serviceWorker.register('/sw.js?target='+encodeURIComponent(t));await navigator.serviceWorker.ready;const reg=await navigator.serviceWorker.getRegistration();await new Promise(resolve=>{navigator.serviceWorker.onmessage=resolve;reg.active.postMessage('go')});`,
    prefetch_preconnect: `for(const rel of ['prefetch','preconnect','dns-prefetch']){const el=document.createElement('link');el.rel=rel;el.href=t;document.head.append(el)}`,
    beacon: `navigator.sendBeacon(t,'fixture');`,
    webrtc: `const pc=new RTCPeerConnection({iceServers:[{urls:'stun:10.66.0.1:3478'}]});pc.createDataChannel('probe');await pc.setLocalDescription(await pc.createOffer());`,
    mixed_dns: `fetch(t).catch(()=>{});`,
    rebind_dns: `fetch(t).catch(()=>{});`,
  }[mechanism];
  if (!code) return { status: 404, body: '' };
  return { body: `<html><body><script>(async()=>{const t=${safeTarget};try{${code}document.body.dataset.attempted='${mechanism}'}catch{document.body.dataset.error='${mechanism}'}})()</script></body></html>` };
}

export function dnsAnswer(query, publicIp, zone, count) {
  let offset = 12; const labels = [];
  while (offset < query.length && query[offset]) { const len = query[offset++]; if (len > 63 || offset + len > query.length) throw Error('bad dns'); labels.push(query.subarray(offset, offset + len).toString()); offset += len; }
  offset++; if (offset + 4 > query.length) throw Error('bad dns');
  const host = labels.join('.').toLowerCase(), type = query.readUInt16BE(offset); const end = offset + 4;
  let ips = [];
  if ((host === zone || host.endsWith(`.${zone}`)) && type === 1) {
    ips = host.startsWith('mixed.') ? [publicIp, '10.66.0.1'] : host.startsWith('rebind.') && count > 1 ? ['10.66.0.1'] : [publicIp];
  }
  const header = Buffer.alloc(12); query.copy(header, 0, 0, 2); header.writeUInt16BE(0x8180, 2); header.writeUInt16BE(1, 4); header.writeUInt16BE(ips.length, 6);
  const records = ips.map(ip => { const r = Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 0, 0, 4, ...ip.split('.').map(Number)]); return r; });
  return Buffer.concat([header, query.subarray(12, end), ...records]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const zone = process.env.FIXTURE_ZONE, publicIp = process.env.FIXTURE_PUBLIC_IPV4, key = process.env.FIXTURE_ADMIN_KEY;
  if (!zone || !publicIp || !key || key.length < 32) throw Error('Fixture configuration required');
  let dnsCount = 0;
  const handler = (req, res) => {
    const u = new URL(req.url, `https://${zone}`);
    if (u.pathname === '/admin/reset') {
      const expected = createHash('sha256').update(`Bearer ${key}`).digest();
      const actual = createHash('sha256').update(req.headers.authorization || '').digest();
      if (req.method !== 'POST' || !timingSafeEqual(expected, actual)) { res.writeHead(401).end(); return; }
      dnsCount = 0; res.end('{}'); return;
    }
    const result = fixtureResponse(u.pathname, u.searchParams.get('target') || 'http://10.66.0.1/', `https://${zone}`);
    res.writeHead(result.status || 200, { 'Content-Type': result.type || 'text/html', 'Cache-Control': 'no-store', ...(result.location ? { Location: result.location } : {}) }); res.end(result.body);
  };
  http.createServer(handler).listen(80, '0.0.0.0');
  https.createServer({ key: readFileSync(process.env.FIXTURE_TLS_KEY), cert: readFileSync(process.env.FIXTURE_TLS_CERT) }, handler).listen(443, '0.0.0.0');
  const answer = query => { const text = query.toString('latin1'); if (text.includes('rebind')) dnsCount++; return dnsAnswer(query, publicIp, zone, dnsCount); };
  const udp = dgram.createSocket('udp4'); udp.on('message', (query, peer) => { try { udp.send(answer(query), peer.port, peer.address); } catch { /* malformed */ } }); udp.bind(53, '0.0.0.0');
  net.createServer(socket => { let buffer = Buffer.alloc(0); socket.on('data', chunk => { buffer = Buffer.concat([buffer, chunk]); if (buffer.length > 8192) return socket.destroy(); if (buffer.length >= 2 && buffer.length >= buffer.readUInt16BE(0) + 2) { try { const data = answer(buffer.subarray(2)); const len = Buffer.alloc(2); len.writeUInt16BE(data.length); socket.end(Buffer.concat([len, data])); } catch { socket.destroy(); } } }); }).listen(53, '0.0.0.0');
}
