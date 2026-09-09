import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl, validateUrl, networkPolicy, DENY_V4, validateResult, HTML_BYTES } from '../policy.mjs';
import { render, LAUNCH } from '../job.mjs';
import { jobArgs, Isolation } from '../isolation.mjs';

test('URL contract rejects nonpublic/alternate addresses, nonstandard ports and unsupported inputs', async () => {
  for (const url of [null, {}, 'file:///etc/passwd', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://0.0.0.0', 'http://10.1.1.1', 'http://169.254.169.254', 'http://[::1]', 'http://[::ffff:8.8.8.8]', 'https://user:pass@example.com', 'https://example.com:8080']) assert.throws(() => parseUrl(url));
  assert.equal(parseUrl('https://example.com:443/p#fragment').href, 'https://example.com/p');
  await assert.rejects(validateUrl('https://example.com', { resolve4: async () => ['8.8.8.8', '10.0.0.1'], resolve6: async () => [] }));
});
test('kernel policy includes reserved/host deny before public ports, fixed DNS and all-v6 denial', () => {
  const policy = networkPolicy({ dns: '1.1.1.1', blocked: ['8.8.4.4'] });
  for (const cidr of DENY_V4) assert.ok(policy.includes(cidr));
  assert.ok(policy.indexOf('8.8.4.4') < policy.indexOf('tcp dport { 80, 443 }'));
  assert.match(policy, /meta nfproto ipv6 counter drop/);
  assert.match(policy, /ip daddr 1.1.1.1 udp dport 53 counter accept/);
  assert.match(policy, /hook output priority -200; policy drop/);
  assert.match(networkPolicy({ dns: '1.1.1.1', host: true }), /iifname "br-folio-render" counter drop/);
  assert.throws(() => networkPolicy({ dns: '127.0.0.1' }));
  assert.throws(() => networkPolicy({ dns: '1.1.1.1', blocked: ['1; flush ruleset'] }));
});
test('job configuration contains no secret, host socket, CDP port or privileged browser', () => {
  const args = jobArgs({ seccomp: '/safe/seccomp.json', resolv: '/safe/resolv.conf', image: 'sha256:fixture' }, 'folio-render-fixture');
  for (const bound of ['--read-only', '--cpus', '--memory', '--pids-limit', '--tmpfs', 'ALL', '1000:1000']) assert.ok(args.includes(bound));
  assert.ok(!args.includes('--privileged') && !args.includes('--cap-add') && !args.includes('--env') && !args.includes('-p'));
  assert.equal(args.filter(x => x.includes('docker.sock')).length, 1); // host CLI connection only, never a mount.
  assert.equal(LAUNCH.pipe, true);
  assert.ok(!LAUNCH.args.some(x => /no-sandbox|remote-debugging-port/.test(x)));
});
function fakeBrowser({ html = '<html>Product</html>', status = 200, navigationError } = {}) {
  let closed = false;
  const page = { createCDPSession: async () => ({ send: async () => {} }), goto: async () => { if (navigationError) throw navigationError; return { status: () => status }; }, waitForNetworkIdle: async () => {}, content: async () => html, url: () => 'https://example.com/final' };
  return { browser: { newPage: async () => page, on: () => {}, close: async () => { closed = true; } }, closed: () => closed };
}
test('runner returns final URL/status and closes on success, captcha, timeout and oversized content', async () => {
  const good = fakeBrowser();
  assert.deepEqual(await render('https://example.com', async () => good.browser), { html: '<html>Product</html>', finalUrl: 'https://example.com/final', status: 200 });
  assert.equal(good.closed(), true);
  for (const [options, code] of [[{ status: 403 }, 'retailer_blocked'], [{ navigationError: { name: 'TimeoutError' } }, 'navigation_timeout'], [{ html: 'x'.repeat(HTML_BYTES + 1) }, 'oversized_response']]) {
    const fake = fakeBrowser(options);
    await assert.rejects(render('https://example.com', async () => fake.browser), e => e.code === code);
    assert.equal(fake.closed(), true);
  }
  await assert.rejects(render('https://example.com', async () => { throw Error('secret'); }), e => e.code === 'browser_launch_failure');
  assert.throws(() => validateResult({ html: '', status: 200, finalUrl: 'http://127.0.0.1' }));
});
test('isolation setup failure never starts Chromium and still destroys the job', async () => {
  const calls = [];
  const isolation = new Isolation({ dns: '1.1.1.1' }, async (program, args) => { calls.push([program, ...args]); return { code: 0, text: '' }; });
  isolation.verifyHost = async () => {};
  isolation.checked = async (program, args) => {
    calls.push([program, ...args]);
    if (args.includes('inspect')) return JSON.stringify([{ State: { Running: true, Pid: 123 } }]);
    if (program === 'nsenter') throw Error('nft failed');
    return '';
  };
  await assert.rejects(isolation.render('https://example.com'), e => e.code === 'isolation_setup_failure');
  assert.ok(calls.some(c => c.includes('rm')));
  assert.ok(!calls.some(c => c.includes('exec')));
});
test('render exception always destroys the isolated job; cleanup failure closes admission', async () => {
  const isolation = new Isolation({}, async () => ({ code: 1, text: '' }));
  isolation.createJob = async () => ({ name: 'test-job' });
  isolation.runJob = async () => { throw Error('timeout'); };
  isolation.healthy = true;
  await assert.rejects(isolation.render('https://example.com'));
  assert.equal(isolation.healthy, false);
});
