/**
 * Proxy address management for Folio email integration.
 *
 * Each designer gets a stable proxy address like:
 *   sarah.chen.a8f3@mail.folioad.com
 *
 * Replies to this address are captured by Resend inbound webhooks.
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

const PROXY_DOMAIN = 'mail.folioad.com';

/**
 * Generate a deterministic proxy address for a user.
 * Format: firstname.lastname.hash4@mail.folioad.com
 */
function generateAddress(userId: string, name: string): string {
  const hash = createHash('sha256').update(userId).digest('hex').slice(0, 4);
  const parts = name.trim().toLowerCase().split(/\s+/);
  const firstName = parts[0]?.replace(/[^a-z]/g, '') || 'user';
  const lastName = parts.length > 1
    ? parts[parts.length - 1].replace(/[^a-z]/g, '')
    : 'designer';

  return `${firstName}.${lastName}.${hash}@${PROXY_DOMAIN}`;
}

/**
 * Get the proxy address for a user, creating one if it doesn't exist.
 */
export async function getOrCreateProxyAddress(userId: string): Promise<string> {
  const existing = await prisma.proxyAddress.findUnique({
    where: { userId },
  });

  if (existing) return existing.address;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true },
  });

  const address = generateAddress(userId, user.name);

  const created = await prisma.proxyAddress.upsert({
    where: { userId },
    update: {},
    create: { userId, address },
  });

  return created.address;
}

/**
 * Look up a user ID from a proxy address.
 * Used for inbound email matching.
 */
export async function getUserIdFromProxyAddress(address: string): Promise<string | null> {
  const record = await prisma.proxyAddress.findUnique({
    where: { address },
  });
  return record?.userId ?? null;
}
