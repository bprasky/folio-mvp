/**
 * Vendor claim turnover (Product Tag Lifecycle Phase 2).
 *
 * When a vendor claims their organization, unclaimed products (vendorId null)
 * that live on the vendor's own domain turn over to them — vendorId is set to
 * the claiming user, so the existing edit gate hands editing control to the
 * vendor. Matching is DETERMINISTIC: a product turns over only when its URL's
 * registrable domain equals one of the organization's verified domains (the
 * same domain set that authorized the claim in canClaimOrganization). Fuzzy
 * brand-name matches are intentionally NOT included.
 *
 * Tags are never touched here — only Product.vendorId changes — so tag count
 * and per-designer attribution are fully preserved. See
 * tasks/PRODUCT_TAG_LIFECYCLE_SPEC.md.
 */

import { prisma } from '@/lib/prisma';
import { inferVendorDomains } from './domain-verification';

/** Collapse a hostname to its registrable domain (naive last-two-labels, the
 *  same approach flaggedDomains uses — fine for the .com vendors Folio sees). */
function registrableDomain(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase().split('.').slice(-2).join('.');
}

/** Registrable domain of a product URL, or null if it can't be parsed. */
function urlDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return registrableDomain(u.hostname);
  } catch {
    return null;
  }
}

/**
 * Turn unclaimed products over to the claiming vendor.
 *
 * - DOMAIN match (product URL domain == an org domain): auto-assign vendorId and
 *   record a CONFIRMED ProductClaimCandidate row (turnover audit trail).
 * - BRAND-only match (product.brand == org name, no domain match): do NOT
 *   assign — queue a PENDING ProductClaimCandidate for vendor review (Phase 3).
 *
 * Returns counts of each. Tags are never touched, so attribution is preserved.
 */
export async function turnoverUnclaimedProducts(
  organizationId: string,
  vendorUserId: string,
): Promise<{ matched: number; candidates: number }> {
  const orgDomains = new Set(
    (await inferVendorDomains(organizationId))
      .map(registrableDomain)
      .filter(Boolean),
  );
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const orgName = org?.name?.trim().toLowerCase() ?? '';

  // URL/brand are free-form strings, so we can't filter the match in SQL — scan
  // unclaimed products and classify in app code. Bounded by the unclaimed set,
  // which is small at MVP scale.
  const candidates = await prisma.product.findMany({
    where: { vendorId: null },
    select: { id: true, url: true, brand: true },
  });

  const domainMatchIds: string[] = [];
  const brandOnlyIds: string[] = [];
  for (const p of candidates) {
    const d = p.url ? urlDomain(p.url) : null;
    if (d != null && orgDomains.has(d)) {
      domainMatchIds.push(p.id);
    } else if (orgName && p.brand && p.brand.trim().toLowerCase() === orgName) {
      brandOnlyIds.push(p.id);
    }
  }

  // Domain matches: assign + record a CONFIRMED candidate (audit). Re-guard
  // vendorId null so a concurrent claim can't clobber an assigned product.
  if (domainMatchIds.length > 0) {
    await prisma.product.updateMany({
      where: { id: { in: domainMatchIds }, vendorId: null },
      data: { vendorId: vendorUserId },
    });
    const now = new Date();
    for (const productId of domainMatchIds) {
      await prisma.productClaimCandidate.upsert({
        where: { productId_organizationId: { productId, organizationId } },
        create: {
          productId,
          organizationId,
          matchType: 'DOMAIN',
          status: 'CONFIRMED',
          reviewedById: vendorUserId,
          reviewedAt: now,
        },
        update: {
          matchType: 'DOMAIN',
          status: 'CONFIRMED',
          reviewedById: vendorUserId,
          reviewedAt: now,
        },
      });
    }
  }

  // Brand-only matches: queue for review without assigning. Leave any existing
  // decision intact on re-claim.
  for (const productId of brandOnlyIds) {
    await prisma.productClaimCandidate.upsert({
      where: { productId_organizationId: { productId, organizationId } },
      create: { productId, organizationId, matchType: 'BRAND', status: 'PENDING' },
      update: {},
    });
  }

  return { matched: domainMatchIds.length, candidates: brandOnlyIds.length };
}
