import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';

export class UnsafeProductUrl extends Error {
  constructor() { super('This URL cannot be scraped'); }
}

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch { return false; }
}

export function parseProductUrl(input: unknown): URL {
  if (typeof input !== 'string' || input.length > 4096) throw new UnsafeProductUrl();
  let url: URL;
  try { url = new URL(input); } catch { throw new UnsafeProductUrl(); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host === 'metadata.google.internal' || host.includes('%') ||
      (ipaddr.isValid(host) && !isPublicAddress(host))) throw new UnsafeProductUrl();
  return url;
}

export async function validateProductUrl(input: unknown, resolve = lookup) {
  const url = parseProductUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: Awaited<ReturnType<typeof lookup>>[];
  try { addresses = await resolve(host, { all: true, verbatim: true }); }
  catch { throw new UnsafeProductUrl(); }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new UnsafeProductUrl();
  return { url, address: addresses[0] };
}

export interface SafeResource {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

/** One request only. DNS results are validated and pinned to the actual socket. */
export async function safeProductResource(input: string, options: { maxBytes?: number; timeoutMs?: number; accept?: string } = {}): Promise<SafeResource> {
  const deadline = Date.now() + (options.timeoutMs ?? 15000);
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const { url, address } = await Promise.race([
    validateProductUrl(input),
    new Promise<never>((_resolve, reject) => {
      dnsTimer = setTimeout(() => reject(new UnsafeProductUrl()), Math.max(1, deadline - Date.now()));
    }),
  ]).finally(() => clearTimeout(dnsTimer));
  return new Promise<SafeResource>((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, {
      agent: false,
      family: address.family,
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FolioProduct/1.0)', Accept: options.accept ?? 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
    }, (res) => {
      const status = res.statusCode || 502;
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(res.headers)) {
        if (value !== undefined && !['connection', 'transfer-encoding', 'content-length'].includes(key)) headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.destroy();
        resolve({ status, headers, body: Buffer.alloc(0) });
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > (options.maxBytes ?? 5 * 1024 * 1024)) { res.destroy(); reject(new UnsafeProductUrl()); }
        else chunks.push(chunk);
      });
      res.on('end', () => resolve({ status, headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new UnsafeProductUrl()), Math.max(1, deadline - Date.now()));
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
}

/** Every redirect returns through the same connection-time validation. */
export async function safeProductFetch(input: string, redirects = 0): Promise<{ html: string; status: number }> {
  if (redirects > 5) throw new UnsafeProductUrl();
  const response = await safeProductResource(input);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (!response.headers.location) throw new UnsafeProductUrl();
    return safeProductFetch(new URL(response.headers.location, input).href, redirects + 1);
  }
  return { html: response.body.toString('utf8'), status: response.status };
}
