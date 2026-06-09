import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Thrown by {@link assertPublicUrl} when a URL is not safe to fetch
 * server-side (bad scheme, unresolvable host, or resolves to a
 * private/reserved/metadata address).
 */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

/** True if an IPv4 literal is loopback / private / link-local / CGNAT / reserved. */
function isDisallowedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
  return false;
}

/** True if an IPv6 literal is loopback / unique-local / link-local / mapped-private. */
function isDisallowedIpv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) or IPv4-compatible — validate the embedded IPv4.
  const mapped = addr.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isDisallowedIpv4(mapped[1]);
  const first = parseInt(addr.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local (incl. AWS IMDSv6 fd00:ec2::254)
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** Refuse anything that isn't a valid public IPv4/IPv6 literal. */
function isDisallowedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isDisallowedIpv4(ip);
  if (kind === 6) return isDisallowedIpv6(ip);
  return true;
}

/**
 * Validate that a user-supplied URL is safe to fetch server-side, to prevent
 * SSRF. Allows only http/https, resolves the hostname, and rejects if ANY
 * resolved address is loopback, private, link-local, CGNAT, multicast,
 * reserved, or a cloud-metadata endpoint (e.g. 169.254.169.254). Throws
 * {@link BlockedUrlError} on any failure; returns the parsed URL on success.
 *
 * This validates at DNS-resolution time and does not pin the resolved IP into
 * the subsequent fetch, so a determined DNS-rebinding attacker could still
 * race the lookup. Pinning the address into the fetch agent is a stronger
 * follow-up if this surface ever takes high-volume untrusted traffic.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('Only http and https URLs are allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const resolved = await lookup(hostname, { all: true });
      addresses = resolved.map((r) => r.address);
    } catch {
      throw new BlockedUrlError('Could not resolve host');
    }
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError('Could not resolve host');
  }
  for (const addr of addresses) {
    if (isDisallowedIp(addr)) {
      throw new BlockedUrlError('URL resolves to a disallowed (private or reserved) address');
    }
  }

  return url;
}
