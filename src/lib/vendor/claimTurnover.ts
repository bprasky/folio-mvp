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
 * Assign unclaimed products on the org's domain to the claiming vendor user.
 * Returns the number of products turned over.
 */
export async function turnoverUnclaimedProducts(
  organizationId: string,
  vendorUserId: string,
): Promise<{ matched: number }> {
  const orgDomains = new Set(
    (await inferVendorDomains(organizationId))
      .map(registrableDomain)
      .filter(Boolean),
  );
  if (orgDomains.size === 0) return { matched: 0 };

  // URL is a free-form string, so we can't filter by domain in SQL — scan the
  // unclaimed products that have a URL and match registrable domains in app
  // code. Bounded by the unclaimed-with-URL set, which is small at MVP scale.
  const candidates = await prisma.product.findMany({
    where: { vendorId: null, url: { not: null } },
    select: { id: true, url: true },
  });

  const toAssign = candidates
    .filter((p) => {
      const d = p.url ? urlDomain(p.url) : null;
      return d != null && orgDomains.has(d);
    })
    .map((p) => p.id);

  if (toAssign.length === 0) return { matched: 0 };

  // Re-guard vendorId null in the write so a concurrent claim can't clobber an
  // already-assigned product.
  await prisma.product.updateMany({
    where: { id: { in: toAssign }, vendorId: null },
    data: { vendorId: vendorUserId },
  });

  return { matched: toAssign.length };
}
