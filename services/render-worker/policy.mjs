import ipaddr from 'ipaddr.js';
import { Resolver } from 'node:dns/promises';

export const HTML_BYTES = 5 * 1024 * 1024;
export const OUTPUT_BYTES = HTML_BYTES * 6 + 8192; // JSON escaping worst case.
export const JOB_MS = 45000;
export const ERRORS = new Set(['invalid_url', 'forbidden_destination', 'isolation_setup_failure', 'browser_launch_failure', 'navigation_timeout', 'retailer_blocked', 'oversized_response', 'internal_worker_error']);
export class RenderError extends Error {
  constructor(code) { super(code); this.code = ERRORS.has(code) ? code : 'internal_worker_error'; }
}
export function publicIPv4(value) {
  try { const ip = ipaddr.parse(value); return ip.kind() === 'ipv4' && ip.range() === 'unicast'; } catch { return false; }
}
export function parseUrl(input) {
  if (typeof input !== 'string' || input.length > 4096) throw new RenderError('invalid_url');
  let url;
  try { url = new URL(input); } catch { throw new RenderError('invalid_url'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new RenderError('invalid_url');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal' ||
      (ipaddr.isValid(host) && !publicIPv4(host))) throw new RenderError('forbidden_destination');
  url.hash = '';
  return url;
}
export async function validateUrl(input, resolver) {
  const url = parseUrl(input);
  if (publicIPv4(url.hostname)) return url.href;
  try {
    const records = await resolver.resolve4(url.hostname);
    const v6 = await resolver.resolve6(url.hostname).catch(e => {
      if (['ENODATA', 'ENOTFOUND'].includes(e.code)) return [];
      throw e;
    });
    // IPv6 connectivity is deliberately unsupported, even for mixed answers.
    // Public v6 alongside public v4 is harmless; private/special v6 is not.
    if (!records.length || records.some(ip => !publicIPv4(ip)) || v6.some(ip => ipaddr.parse(ip).range() !== 'unicast')) throw Error();
    return url.href;
  } catch { throw new RenderError('forbidden_destination'); }
}
export function trustedResolver(address) {
  if (!publicIPv4(address)) throw new RenderError('isolation_setup_failure');
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  resolver.setServers([address]);
  return resolver;
}

// Conservative special-use blocklist. Keep aligned with IANA and ipaddr's policy.
export const DENY_V4 = ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.31.196.0/24', '192.52.193.0/24', '192.88.99.0/24', '192.168.0.0/16', '192.175.48.0/24', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4'];
export function networkPolicy({ dns, blocked = [], host = false, bridge = 'br-folio-render' }) {
  if (!publicIPv4(dns) || !/^br-[a-z0-9-]{1,12}$/.test(bridge)) throw new RenderError('isolation_setup_failure');
  if (blocked.some(ip => !ipaddr.isValid(ip) || ipaddr.parse(ip).kind() !== 'ipv4')) throw new RenderError('isolation_setup_failure');
  const extra = blocked.filter(ip => !DENY_V4.some(cidr => ipaddr.parse(ip).match(ipaddr.parseCIDR(cidr))));
  const deny = [...new Set([...DENY_V4, ...extra])].join(', ');
  const egress = `meta nfproto ipv6 counter drop
    ip daddr { ${deny} } counter drop
    ip daddr ${dns} udp dport 53 counter accept
    ip daddr ${dns} tcp dport 53 counter accept
    tcp dport { 80, 443 } counter accept
    counter drop`;
  return `table inet folio_render {
  chain egress { ${egress} }
  ${host ? `chain forward { type filter hook forward priority -200; policy accept; iifname "${bridge}" jump egress; }
  chain input { type filter hook input priority -200; policy accept; iifname "${bridge}" counter drop; }` : `chain output { type filter hook output priority -200; policy drop; jump egress; }
  chain input { type filter hook input priority -200; policy drop; meta nfproto ipv6 counter drop; ct state established,related counter accept; counter drop; }`}
}
`;
}

export function validateResult(result) {
  if (!result || Object.keys(result).sort().join(',') !== 'finalUrl,html,status' || typeof result.html !== 'string' ||
      Buffer.byteLength(result.html) > HTML_BYTES || !Number.isInteger(result.status) || result.status < 100 || result.status > 599) throw new RenderError('oversized_response');
  parseUrl(result.finalUrl);
  return result;
}
