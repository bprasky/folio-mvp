import puppeteer from 'puppeteer-core';
import { safeProductResource, validateProductUrl } from '@/lib/server/safe-product-url';

// Chromium cannot make its own connections. HTTP is fulfilled over CDP by
// Folio's pinned transport; WebSockets, workers and popups have no direct egress.
export const PRODUCT_BROWSER_ARGS = [
  '--proxy-server=http://127.0.0.1:0',
  '--proxy-bypass-list=<-loopback>',
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--disable-quic',
  '--enable-automation',
];

export function assertProtectedBrowserArgs(actual: string[]) {
  for (const required of PRODUCT_BROWSER_ARGS) {
    const name = required.split('=')[0];
    const matches = actual.filter(arg => arg === name || arg.startsWith(`${name}=`));
    if (matches.length !== 1 || matches[0] !== required) throw new Error(`Browser egress controls unavailable: ${name} (${matches.length ? 'conflicting' : 'missing'})`);
  }
}

export async function protectedProductHtml(input: string): Promise<string | null> {
  await validateProductUrl(input);
  const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
  if (!token) return null;
  const endpoint = new URL(process.env.BROWSERLESS_PROTECTED_WS_URL || 'wss://production-sfo.browserless.io/chromium');
  if (endpoint.protocol !== 'wss:') throw new Error('Protected browser endpoint must use TLS');
  endpoint.searchParams.set('token', token);
  endpoint.searchParams.set('timeout', '45000');
  endpoint.searchParams.set('launch', JSON.stringify({ args: PRODUCT_BROWSER_ARGS }));
  for (const arg of PRODUCT_BROWSER_ARGS) {
    const split = arg.indexOf('=');
    endpoint.searchParams.set(split < 0 ? arg : arg.slice(0, split), split < 0 ? 'true' : arg.slice(split + 1));
  }
  const browser = await puppeteer.connect({ browserWSEndpoint: endpoint.href, protocolTimeout: 15000 });
  try {
    const control = await browser.target().createCDPSession();
    const { arguments: args } = await control.send('Browser.getBrowserCommandLine');
    assertProtectedBrowserArgs(args);
    const page = await browser.newPage();
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    let count = 0;
    let bytes = 0;
    page.on('request', async request => {
      try {
        // Read-only scraping does not submit forms or execute remote mutations.
        if (request.method() !== 'GET' || ++count > 100 || bytes > 20 * 1024 * 1024) {
          await request.abort(); return;
        }
        const result = await safeProductResource(request.url());
        bytes += result.body.length;
        await request.respond({ status: result.status, headers: result.headers, body: result.body });
      } catch { if (!request.isInterceptResolutionHandled()) await request.abort().catch(() => {}); }
    });
    await page.goto(input, { waitUntil: 'networkidle2', timeout: 30000 });
    return await page.content();
  } finally { await browser.close(); }
}
