// Real Chromium enforcing next.config.js response headers and the installed Daily
// loader. Remote bundle/media bytes are synthetic; no room, device, key or paid call.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const config = require('../next.config.js');

async function main() {
  const headers = (await config.headers()).find(rule => rule.source === '/:path*').headers;
  const policy = headers.find(header => header.key === 'Content-Security-Policy').value;
  const daily = fs.readFileSync(path.join(path.dirname(require.resolve('@daily-co/daily-js')), 'daily.js'));
  // One tenth of a second of PCM silence, sufficient to prove browser decoding.
  const wav = Buffer.alloc(44 + 1600);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(1600, 40);
  const server = http.createServer((req, res) => {
    for (const { key, value } of headers) res.setHeader(key, value);
    if (req.url === '/daily.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(daily); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><script>window.violations=[];document.addEventListener("securitypolicyviolation",e=>violations.push({directive:e.effectiveDirective,url:e.blockedURI}));</script><script src="/daily.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const executablePath = process.env.GUIDED_TEST_BROWSER || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].find(file => fs.existsSync(file));
  assert.ok(executablePath, 'Chromium is required to verify the production CSP.');
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    await page.setRequestInterception(true);
    const requests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.startsWith(base) || url.startsWith('blob:')) return void request.continue();
      requests.push(url);
      if (url.endsWith('/call-machine-object-bundle.js')) return void request.respond({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'window.syntheticDailyBundleExecuted=true;' });
      if (url.includes('/private-csp-fixture.wav')) return void request.respond({ status: 200, contentType: 'audio/wav', headers: { 'Access-Control-Allow-Origin': '*' }, body: wav });
      return void request.respond({ status: 200, contentType: 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: 'synthetic' });
    });
    const response = await page.goto(base);
    assert.equal(response.headers()['content-security-policy'], policy);
    // Same default loader as LiveInterviewPanel, no URL/token and no join().
    await page.evaluate(() => {
      window.call = Daily.createCallObject({ audioSource: false, videoSource: false, startAudioOff: true, startVideoOff: true });
      window.call.load().then(() => { window.dailyLoaded = true; }).catch(error => { window.dailyLoadError = String(error); });
    });
    try { await page.waitForFunction(() => window.dailyLoaded && window.syntheticDailyBundleExecuted); }
    catch { throw new Error(`Daily bootstrap blocked: ${JSON.stringify(await page.evaluate(() => window.violations))}`); }
    assert.ok(requests.some(url => /^https:\/\/c\.daily\.co\/call-machine\/versioned\//.test(url)), 'installed Daily default CDN loader executes');
    console.log('PASS installed Daily call-object bootstrap under production CSP (synthetic remote bundle)');

    const allowedHttps = ['https://fixture.daily.co', 'https://fixture.dailywebrtc.com', 'https://fixture.dailywebrtc.net', 'https://prod-ks.pluot.blue'];
    assert.deepEqual(await page.evaluate(urls => Promise.all(urls.map(async url => { await fetch(`${url}/csp-fixture`); return true; })), allowedHttps), allowedHttps.map(() => true));
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(new Blob(['postMessage("worker ready")'], { type: 'text/javascript' }));
        const worker = new Worker(url);
        worker.onmessage = () => { worker.terminate(); URL.revokeObjectURL(url); resolve(); };
        worker.onerror = reject;
      });
      for (const tag of ['audio', 'video']) {
        const media = document.createElement(tag);
        await new Promise((resolve, reject) => {
          media.onloadedmetadata = resolve; media.onerror = () => reject(new Error(`${tag} private playback blocked`));
          media.src = 'https://fixture.supabase.co/storage/v1/object/sign/interview-media/private-csp-fixture.wav?token=synthetic';
          media.load();
        });
        media.removeAttribute('src'); media.load();
      }
      const blob = await (await fetch('https://fixture.supabase.co/private-csp-fixture.wav')).blob();
      const url = URL.createObjectURL(blob); const audio = new Audio();
      await new Promise((resolve, reject) => { audio.onloadedmetadata = resolve; audio.onerror = reject; audio.src = url; });
      URL.revokeObjectURL(url);
      // Close immediately: exercise the browser's CSP decision without a handshake.
      for (const domain of ['daily.co', 'dailywebrtc.com', 'dailywebrtc.net']) {
        for (const host of [`fixture.wss.${domain}`, `fixture-wss.${domain}`]) { const ws = new WebSocket(`wss://${host}`); ws.close(); }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(await page.evaluate(() => window.violations), [], 'allowed paths must produce no CSP violations');
    console.log('PASS Daily HTTPS/fallback/WSS hosts, blob workers, private audio/video and blob playback');

    await page.evaluate(async () => {
      await fetch('https://unrelated.example.invalid/csp-fixture').catch(() => {});
      const ws = new WebSocket('wss://unrelated.example.invalid/csp-fixture'); ws.close();
      const audio = new Audio('https://unrelated.example.invalid/private-csp-fixture.wav'); audio.load();
      const script = document.createElement('script'); script.src = 'https://unrelated.example.invalid/untrusted.js'; document.head.append(script);
    });
    await page.waitForFunction(() => window.violations.length >= 4);
    const denied = await page.evaluate(() => window.violations);
    for (const directive of ['connect-src', 'media-src', 'script-src-elem']) assert.ok(denied.some(item => item.directive === directive), `${directive} rejects unrelated origins`);
    assert.ok(denied.some(item => item.url.startsWith('wss://unrelated.example.invalid')), 'unrelated WSS is blocked');
    assert.equal(requests.some(url => url.includes('unrelated.example.invalid')), false, 'denied requests never leave the page');
    assert.match(policy, /frame-ancestors 'none'/);
    assert.equal(headers.find(header => header.key === 'Permissions-Policy').value, 'camera=(self), microphone=(self), geolocation=()');
    console.log('PASS unrelated script/media/HTTPS/WSS blocked; anti-framing and device permissions retained');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
