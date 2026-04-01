/**
 * Shadow Profile → Live Merge
 *
 * When a vendor org is claimed or a rep joins, merge shadow profile data
 * into the live account. Historical metrics transfer seamlessly.
 */

import { prisma } from '@/lib/prisma';

/**
 * Merge a VendorShadowProfile into a live Organization.
 * Called when a vendor claims their org profile.
 */
export async function mergeVendorShadow(
  vendorOrgId: string,
  vendorName: string
): Promise<boolean> {
  try {
    // Find shadow profile by vendor name
    const shadow = await prisma.vendorShadowProfile.findUnique({
      where: { vendorName },
      include: { reps: true },
    });

    if (!shadow) {
      // Try case-insensitive match
      const shadowAlt = await prisma.vendorShadowProfile.findFirst({
        where: { vendorName: { equals: vendorName, mode: 'insensitive' } },
        include: { reps: true },
      });
      if (!shadowAlt) return false;

      // Link shadow to org
      await prisma.vendorShadowProfile.update({
        where: { id: shadowAlt.id },
        data: {
          vendorOrgId,
          claimedAt: new Date(),
        },
      });

      return true;
    }

    // Link shadow to org
    await prisma.vendorShadowProfile.update({
      where: { id: shadow.id },
      data: {
        vendorOrgId,
        claimedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.error('[mergeVendorShadow] Failed:', error);
    return false;
  }
}

/**
 * Merge a RepShadowProfile into a live User account.
 * Called when a rep joins Folio (signup or invite acceptance).
 */
export async function mergeRepShadow(
  userId: string,
  userEmail: string
): Promise<boolean> {
  try {
    // Find rep shadow profiles matching this email
    const repShadows = await prisma.repShadowProfile.findMany({
      where: {
        repEmail: { equals: userEmail, mode: 'insensitive' },
        userId: null, // Not yet claimed
      },
    });

    if (repShadows.length === 0) return false;

    // Link all matching shadow profiles to this user
    for (const shadow of repShadows) {
      await prisma.repShadowProfile.update({
        where: { id: shadow.id },
        data: {
          userId,
          claimedAt: new Date(),
        },
      });
    }

    return true;
  } catch (error) {
    console.error('[mergeRepShadow] Failed:', error);
    return false;
  }
}
