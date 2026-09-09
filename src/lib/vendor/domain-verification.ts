import { prisma } from '@/lib/prisma';

/** Domain hints come only from the organization's website, never member emails
 * or product URLs that members can add. Hints are not claim authorization. */
export async function inferVendorDomains(organizationId: string): Promise<string[]> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { website: true } });
  if (!org?.website) return [];
  try {
    const url = new URL(org.website.includes('://') ? org.website : `https://${org.website}`);
    if (!['http:', 'https:'].includes(url.protocol)) return [];
    return [url.hostname.replace(/^www\./, '').toLowerCase()];
  } catch { return []; }
}

/** Evidence check only. Callers must separately prove active membership and
 * admin verification; a matching email or website never creates membership. */
export async function canClaimOrganization(userEmail: string, organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
  const userDomain = userEmail.split('@')[1]?.toLowerCase();
  const domains = await inferVendorDomains(organizationId);
  if (!userDomain || !domains.includes(userDomain)) {
    return { allowed: false, reason: 'Organization website and work email must match. Contact Folio for verification.' };
  }
  return { allowed: true };
}
