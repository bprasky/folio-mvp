import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { HTML_BYTES, RenderError, parseUrl } from './policy.mjs';

export const LAUNCH = {
  executablePath: '/usr/bin/chromium', headless: true, pipe: true,
  // No no-sandbox / privileged browser / TCP debugging. Userns sandbox required.
  args: ['--disable-dev-shm-usage', '--disable-quic', '--disable-background-networking', '--disable-extensions', '--no-first-run', '--user-data-dir=/tmp/profile'],
  timeout: 10000, protocolTimeout: 12000,
};
export async function render(url, launch = options => puppeteer.launch(options)) {
  parseUrl(url);
  let browser;
  try { browser = await launch(LAUNCH); } catch { throw new RenderError('browser_launch_failure'); }
  try {
    const page = await browser.newPage();
    const client = await page.createCDPSession();
    await client.send('Browser.setDownloadBehavior', { behavior: 'deny' });
    browser.on('targetcreated', async target => {
      if (target.type() === 'page' && target !== page.target()) await (await target.page())?.close().catch(() => {});
    });
    // Browser traffic goes through the kernel policy, including workers/WebSockets.
    // Deliberately no request interception security dependency.
    let response;
    try { response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }); }
    catch (error) { throw new RenderError(error.name === 'TimeoutError' ? 'navigation_timeout' : 'forbidden_destination'); }
    await page.waitForNetworkIdle({ idleTime: 750, timeout: 5000 }).catch(() => {});
    const status = response?.status() || 502;
    const html = await page.content();
    if (Buffer.byteLength(html) > HTML_BYTES) throw new RenderError('oversized_response');
    if ([401, 403, 429].includes(status) || /<title[^>]*>[^<]*(?:just a moment|access denied|captcha|verify you are human)/i.test(html)) throw new RenderError('retailer_blocked');
    const finalUrl = parseUrl(page.url()).href;
    return { html, finalUrl, status };
  } finally { await browser.close().catch(() => {}); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Only the controller can start this command. No environment/arguments from callers.
  let raw = '';
  try {
    for await (const chunk of process.stdin) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 8192) throw new RenderError('invalid_url');
    }
    const input = JSON.parse(raw);
    if (Object.keys(input).join(',') !== 'url') throw new RenderError('invalid_url');
    process.stdout.write(JSON.stringify(await render(input.url)));
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error instanceof RenderError ? error.code : 'internal_worker_error' }));
    process.exitCode = 1;
  }
}
