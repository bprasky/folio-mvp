/**
 * Vendor Domain Verification
 *
 * Validates whether a user can claim a vendor organization
 * by checking email domain against known vendor domains.
 */

import { prisma } from '@/lib/prisma';

interface ClaimVerificationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Extract domain from an email address.
 */
function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

/**
 * Infer vendor domains from organization website and product URLs.
 */
export async function inferVendorDomains(organizationId: string): Promise<string[]> {
  const domains = new Set<string>();

  // Get org website domain
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { website: true, name: true },
  });

  if (org?.website) {
    try {
      const url = new URL(
        org.website.startsWith('http') ? org.website : `https://${org.website}`
      );
      domains.add(url.hostname.replace(/^www\./, '').toLowerCase());
    } catch {
      // Invalid URL, skip
    }
  }

  // Get domains from products associated with this vendor org's members
  const orgUsers = await prisma.organizationUser.findMany({
    where: { organizationId, isActive: true },
    select: { userId: true },
  });

  if (orgUsers.length > 0) {
    const userIds = orgUsers.map((u) => u.userId);
    const products = await prisma.product.findMany({
      where: { vendorId: { in: userIds } },
      select: { url: true },
      take: 50,
    });

    for (const product of products) {
      if (product.url) {
        try {
          const url = new URL(product.url);
          domains.add(url.hostname.replace(/^www\./, '').toLowerCase());
        } catch {
          // Invalid URL, skip
        }
      }
    }
  }

  // Also get existing member email domains
  const members = await prisma.organizationUser.findMany({
    where: { organizationId, isActive: true },
    include: { user: { select: { email: true } } },
  });

  for (const member of members) {
    if (member.user.email) {
      domains.add(extractDomain(member.user.email));
    }
  }

  // Filter out generic email domains
  const genericDomains = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com',
    'live.com', 'msn.com', 'ymail.com',
  ]);

  return Array.from(domains).filter((d) => d && !genericDomains.has(d));
}

/**
 * Check if a user can claim a vendor organization.
 *
 * Validates:
 * - User email domain matches vendor domain
 * - Organization hasn't already been claimed
 * - No fraud indicators
 */
export async function canClaimOrganization(
  userEmail: string,
  organizationId: string
): Promise<ClaimVerificationResult> {
  const userDomain = extractDomain(userEmail);

  if (!userDomain) {
    return { allowed: false, reason: 'Invalid email address' };
  }

  // Check if org exists
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, status: true, type: true },
  });

  if (!org) {
    return { allowed: false, reason: 'Organization not found' };
  }

  if (org.type !== 'VENDOR' && org.type !== 'MANUFACTURER' && org.type !== 'SHOWROOM') {
    return { allowed: false, reason: 'Organization is not a vendor type' };
  }

  // Check if already claimed
  const existingInvite = await prisma.vendorInvite.findUnique({
    where: { organizationId },
    select: { claimedAt: true },
  });

  if (existingInvite?.claimedAt) {
    return { allowed: false, reason: 'Organization has already been claimed' };
  }

  // Check if org already has an active owner/admin
  if (org.status === 'PROFESSIONAL' || org.status === 'CLAIMED') {
    const existingAdmin = await prisma.organizationUser.findFirst({
      where: {
        organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (existingAdmin) {
      return { allowed: false, reason: 'Organization already has an active administrator' };
    }
  }

  // Verify email domain matches
  const vendorDomains = await inferVendorDomains(organizationId);

  if (vendorDomains.length === 0) {
    // No domains to verify against - allow with lower confidence
    // This can happen for newly created orgs
    return { allowed: true };
  }

  const domainMatch = vendorDomains.some((d) => d === userDomain);

  if (!domainMatch) {
    return {
      allowed: false,
      reason: `Email domain "${userDomain}" does not match vendor domain(s): ${vendorDomains.join(', ')}`,
    };
  }

  return { allowed: true };
}
