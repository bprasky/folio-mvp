import { validateProductUrl } from './safe-product-url';

export interface RenderedProductPage { html: string; finalUrl: string; status: number }
const MAX_HTML = 5 * 1024 * 1024;
export function hasRenderWorker(): boolean { return !!(process.env.RENDER_WORKER_URL && process.env.RENDER_WORKER_API_KEY); }

/** Trusted URL-only worker. No provider fallback, caller headers, or browser commands. */
export async function renderProductPage(input: string): Promise<RenderedProductPage | null> {
  await validateProductUrl(input);
  if (!hasRenderWorker()) return null;
  const endpoint = new URL(process.env.RENDER_WORKER_URL!);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/render' || process.env.RENDER_WORKER_API_KEY!.length < 32) throw new Error('Render worker configuration unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RENDER_WORKER_API_KEY}` },
      body: JSON.stringify({ url: input }),
    });
    if (!response.ok || !response.body) throw new Error('Renderer unavailable');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > MAX_HTML * 6 + 8192) throw new Error('Render response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as RenderedProductPage;
    if (!result || Object.keys(result).sort().join(',') !== 'finalUrl,html,status' || typeof result.html !== 'string' || Buffer.byteLength(result.html) > MAX_HTML || !Number.isInteger(result.status) || result.status < 100 || result.status > 599) throw new Error('Invalid render result');
    await validateProductUrl(result.finalUrl);
    return result;
  } catch { throw new Error('Protected renderer unavailable'); }
  finally { clearTimeout(timer); }
}
