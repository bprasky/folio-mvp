// ROOT, DEDICATED LINUX TEST HOST ONLY. Never imported by controller or job image.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Isolation, command } from '../isolation.mjs';
import { attacks, parityCases } from './cases.mjs';
import { trustedResolver, validateUrl } from '../policy.mjs';
import { startCanary } from './canary.mjs';

const pause = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function denied(snapshot) {
  return JSON.parse(snapshot).nftables.filter(x => x.rule?.expr?.some(e => 'drop' in e)).reduce((n, x) => n + x.rule.expr.reduce((s, e) => s + (e.counter?.packets || 0), 0), 0);
}
async function main() {
  if (process.platform !== 'linux' || process.getuid?.() !== 0) throw Error('Linux root with Docker/nftables is required; no network tests executed');
  if (process.env.FOLIO_RENDER_TEST_HOST !== 'YES' || (await readFile('/etc/folio-render-acceptance-host', 'utf8')).trim() !== 'DEDICATED TEST HOST') throw Error('Dedicated test-host interlock missing');
  const origin = new URL(process.env.FIXTURE_ORIGIN || '');
  assert.equal(origin.protocol, 'https:');
  const dns = process.env.FIXTURE_PUBLIC_IPV4;
  const resolver = trustedResolver(dns);
  const reset = async () => { const r = await fetch(new URL('/admin/reset', origin), { method: 'POST', headers: { Authorization: `Bearer ${process.env.FIXTURE_ADMIN_KEY}` } }); assert.equal(r.status, 200); };
  const isolation = new Isolation({ dns, image: process.env.RENDER_IMAGE_ID || '', blocked: (process.env.RENDER_BLOCKED_IPV4 || '').split(',').filter(Boolean), seccomp: resolve('seccomp.json'), resolv: '/run/folio-render/resolv.conf' });
  await isolation.initialize();
  await reset();
  // Controller rejects mixed DNS, while the below-browser suite deliberately bypasses URL checks.
  await assert.rejects(validateUrl(`http://mixed.${origin.hostname}/`, resolver));
  async function canary(job) {
    for (const addr of ['10.66.0.1/32', '169.254.10.1/32', '169.254.169.254/32']) await isolation.checked('nsenter', ['-t', String(job.pid), '-n', '--', 'ip', 'address', 'add', addr, 'dev', 'lo']);
    const child = spawn('nsenter', ['-t', String(job.pid), '-n', '--', process.execPath, fileURLToPath(new URL('./canary.mjs', import.meta.url))], { stdio: ['ignore', 'pipe', 'ignore'] });
    let hits = 0, ready = false, text = '';
    child.stdout.on('data', chunk => { text += chunk; while (text.includes('\n')) { const i = text.indexOf('\n'); const line = text.slice(0, i); text = text.slice(i + 1); if (line === 'hit') hits++; if (line === 'ready') ready = true; } });
    for (let i = 0; i < 50 && !ready; i++) await pause(50);
    if (!ready) { child.kill(); throw Error('Canary listener failed to start'); }
    return { hits: () => hits, close: async () => { if (child.exitCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); } } };
  }
  async function browserProbe(job, url, mechanism) {
    // Production launch options, bypassing only the application URL parser for acceptance.
    // There is no such bypass in the production API/image entrypoint.
    const code = `import puppeteer from 'puppeteer-core';import{LAUNCH}from'/worker/job.mjs';const b=await puppeteer.launch(LAUNCH);try{const p=await b.newPage();await p.goto('chrome://sandbox');const sandbox=await p.evaluate(()=>document.body.innerText);if(!/Namespace sandbox\\s+Yes/i.test(sandbox)||!/Seccomp-BPF sandbox\\s+Yes/i.test(sandbox))throw Error('Sandbox not active');let navigationError=null;try{await p.goto(${JSON.stringify(url)},{waitUntil:'domcontentloaded',timeout:6000})}catch(e){navigationError=e.name}await new Promise(r=>setTimeout(r,3000));const marker=await p.evaluate(()=>({attempted:document.body?.dataset.attempted,error:document.body?.dataset.error})).catch(()=>({}));console.log(JSON.stringify({sandbox:true,navigationAttempted:true,navigationError,...marker}))}finally{await b.close()}`;
    const out = await command('docker', ['--host', 'unix:///var/run/docker.sock', 'exec', '-i', job.name, 'node', '--input-type=module', '-e', code], { timeout: 25000, maxBytes: 8192 });
    assert.equal(out.code, 0, 'Browser must launch with its sandbox; launch failure is not a blocked-network PASS');
    const proof = JSON.parse(out.text);
    assert.equal(proof.sandbox, true);
    assert.ok(!proof.error, `Browser mechanism failed to initialize: ${mechanism}`);
    if (mechanism) assert.equal(proof.attempted, mechanism, 'Adversarial fixture did not execute its mechanism');
    return proof;
  }
  // TEST THE TEST: fresh disposable namespace with only its OUTPUT policy removed.
  // Host defense remains. Loopback deliberately reaches a local listener here.
  {
    const job = await isolation.createJob(); let listener;
    try {
      listener = await canary(job);
      await isolation.ns(job.pid, ['delete', 'table', 'inet', 'folio_render']);
      await browserProbe(job, 'http://127.0.0.1/', null);
      assert.ok(listener.hits() > 0, 'Harness cannot detect a deliberate breach');
      results.push({ attack: 'TEST_ONLY_UNRESTRICTED_CONTROL', blocked: false, canaryConnections: listener.hits(), evidence: 'namespace policy deliberately absent; real sandboxed Chromium reached loopback' });
    } finally { await listener?.close(); await isolation.destroy(job.name); }
  }
  // Independent host defense: namespace policy absent, host bridge INPUT still denies.
  {
    let hits = 0;
    const listener = await startCanary({ host: '10.203.0.1', onHit: () => hits++ });
    const job = await isolation.createJob();
    try {
      await isolation.ns(job.pid, ['delete', 'table', 'inet', 'folio_render']);
      const before = denied(await isolation.checked('nft', ['-j', 'list', 'table', 'inet', 'folio_render']));
      await browserProbe(job, 'http://10.203.0.1/', null);
      const after = denied(await isolation.checked('nft', ['-j', 'list', 'table', 'inet', 'folio_render']));
      assert.equal(hits, 0); assert.ok(after > before);
      results.push({ attack: 'host_gateway_defense', blocked: true, canaryConnections: hits, hostDenyPackets: after - before });
    } finally { await listener.close(); await isolation.destroy(job.name); }
  }
  for (const attack of attacks) {
    const job = await isolation.createJob(); let listener;
    try {
      listener = await canary(job);
      await reset();
      let target = attack.target;
      if (attack.id === 'mixed_dns') target = `http://mixed.${origin.hostname}/`;
      if (attack.id === 'rebind_dns') {
        target = `http://rebind.${origin.hostname}/`;
        assert.equal((await resolver.resolve4(new URL(target).hostname))[0], dns); // Validated public answer.
        assert.equal((await resolver.resolve4(new URL(target).hostname))[0], '10.66.0.1'); // Later changed answer.
      }
      const url = attack.direct ? target : new URL(`/${attack.id}?target=${encodeURIComponent(target)}`, attack.id === 'service_worker' ? origin : origin.href.replace('https:', 'http:')).href;
      const before = denied(await isolation.ns(job.pid, ['-j', 'list', 'table', 'inet', 'folio_render']));
      const proof = await browserProbe(job, url, attack.direct || attack.id === 'redirect' ? null : attack.id);
      const afterBrowser = denied(await isolation.ns(job.pid, ['-j', 'list', 'table', 'inet', 'folio_render']));
      // Separate packet witness: ensures the kernel boundary was exercised even if
      // Chromium's mixed-content/PNA policy rejected the browser request earlier.
      // These counters are reported separately, never attributed to browser traffic.
      const host = new URL(attack.target).hostname.replace(/^\[|\]$/g, '');
      const probe = attack.id === 'webrtc' ? `const d=require('dgram').createSocket('udp4');d.send('probe',3478,'10.66.0.1',()=>d.close());` : `const n=require('net');const s=n.connect({host:${JSON.stringify(host)},port:80});s.on('error',()=>{});setTimeout(()=>{s.destroy()},700);`;
      await isolation.docker(['exec', job.name, 'node', '-e', probe]);
      const after = denied(await isolation.ns(job.pid, ['-j', 'list', 'table', 'inet', 'folio_render']));
      const v6 = await isolation.checked('nsenter', ['-t', String(job.pid), '-n', '--', 'sysctl', '-n', 'net.ipv6.conf.all.disable_ipv6']);
      assert.equal(listener.hits(), 0, `Private canary reached: ${attack.id}`);
      assert.ok(attack.ipv6 ? v6.trim() === '1' : after > afterBrowser, 'Missing authoritative kernel packet/IPv6-disable evidence');
      const hostCounters = await isolation.checked('nft', ['-j', 'list', 'table', 'inet', 'folio_render']);
      results.push({ attack: attack.id, blocked: true, canaryConnections: 0, browserDenyPackets: afterBrowser - before, packetWitnessDenyPackets: after - afterBrowser, ipv6Disabled: v6.trim() === '1', browser: proof, hostDeniedPackets: denied(hostCounters) });
    } finally { await listener?.close(); await isolation.destroy(job.name); }
  }
  // Production runner, no URL-validation bypass; rendered output only synthetic data.
  const parity = [];
  for (const category of parityCases) {
    const page = await isolation.render(new URL(`/${category}`, origin).href);
    assert.ok(page.html.includes('Acceptance Oak Chair'));
    assert.equal(page.status, 200);
    assert.ok(page.finalUrl.endsWith(category === 'redirect-product' ? '/hydrated' : `/${category}`));
    parity.push({ category, ...page });
  }
  // Optional real hard-retailer check. Output stores no real HTML/cookies.
  let difficult = { status: 'NOT_RUN', reason: 'Set DIFFICULT_RETAILER_URL to an authorized reproducible case' };
  if (process.env.DIFFICULT_RETAILER_URL) {
    // The adversarial fixture DNS is not recursive. Switch to a normal trusted
    // public resolver only after the controlled matrix and fixture parity finish.
    const dns = process.env.DIFFICULT_DNS_IPV4 || '1.1.1.1';
    const productionLike = new Isolation({ ...isolation.config, dns });
    await productionLike.initialize();
    try { const p = await productionLike.render(await validateUrl(process.env.DIFFICULT_RETAILER_URL, trustedResolver(dns))); difficult = { status: 'RENDERED_EXTRACTOR_CHECK_PENDING', httpStatus: p.status }; }
    catch (e) { difficult = { status: e.code === 'retailer_blocked' ? 'COMPATIBILITY_LIMITATION' : 'FAILED', reason: e.code || 'internal_worker_error' }; }
  }
  await writeFile('acceptance-results.json', JSON.stringify({ results, parity, difficult }, null, 2));
  console.log('PASS: Linux network matrix, deliberate-breach control and synthetic rendering. Run Folio extraction parity against acceptance-results.json.');
}
main().catch(async error => {
  // Do not emit infrastructure details or URL-bearing exceptions.
  await writeFile('acceptance-results.json', JSON.stringify({ status: 'INCOMPLETE_OR_FAILED', completedCases: results, reason: process.platform === 'linux' ? 'Acceptance failed; inspect test host configuration and assertions locally' : 'Linux root/Docker/nftables unavailable; no network cases executed' }, null, 2));
  console.error('FAIL: authoritative Linux acceptance incomplete. See local acceptance-results.json.');
  process.exitCode = 1;
});
