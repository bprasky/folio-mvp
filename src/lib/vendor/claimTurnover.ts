import { prisma } from '@/lib/prisma';
import { inferVendorDomains } from './domain-verification';
import { canClaimExistingProducts } from './claimAuthorization';
import { ClaimConflict, reviewProductClaim } from './reviewProductClaim';

function urlDomain(value: string): string | null {
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.hostname.replace(/^www\./, '').toLowerCase() : null;
  } catch { return null; }
}

/** Called only with a server-session user. Domain matches use exact hosts;
 * unrelated co.uk domains and arbitrary subdomains never collapse together.
 * Brand matches create review candidates, never ownership. */
export async function turnoverUnclaimedProducts(organizationId: string, vendorUserId: string): Promise<{ matched: number; candidates: number }> {
  if (!await canClaimExistingProducts(vendorUserId, organizationId)) throw new ClaimConflict('Organization verification and active vendor membership are required.');
  const domains = await inferVendorDomains(organizationId);
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const products = await prisma.product.findMany({ where: { vendorId: null }, select: { id: true, url: true, brand: true } });
  let matched = 0, candidates = 0;
  for (const product of products) {
    const domain = product.url ? urlDomain(product.url) : null;
    const domainMatch = domain !== null && domains.includes(domain);
    if (!domainMatch && (!org?.name || product.brand?.trim().toLowerCase() !== org.name.trim().toLowerCase())) continue;
    const candidate = await prisma.productClaimCandidate.upsert({
      where: { productId_organizationId: { productId: product.id, organizationId } },
      create: { productId: product.id, organizationId, matchType: domainMatch ? 'DOMAIN' : 'BRAND', status: 'PENDING' },
      update: {},
    });
    if (candidate.status !== 'PENDING') continue;
    if (domainMatch && candidate.matchType === 'DOMAIN') {
      try { await reviewProductClaim(candidate.id, organizationId, vendorUserId, 'confirm'); matched++; }
      catch (error) { if (!(error instanceof ClaimConflict)) throw error; }
    } else candidates++;
  }
  return { matched, candidates };
}
