/**
 * Directory Eligibility Logic
 * Determines who can appear in the directory and manages Pro subscription gates
 */

import { prisma } from '@/lib/prisma';
import type { User, Organization } from '@prisma/client';

// Professional roles that can appear in the designer directory
const PROFESSIONAL_ROLES = ['DESIGNER', 'ARCHITECT', 'BUILDER'] as const;

/**
 * Check if a user is eligible for the designer directory
 * Requirements:
 * - Must be a professional role (DESIGNER, ARCHITECT, BUILDER)
 * - Must have Pro subscription tier
 * - Subscription must not be expired (or null for lifetime)
 */
export function isDesignerDirectoryEligible(user: Pick<User, 'role' | 'subscriptionTier' | 'subscriptionExpiresAt'>): boolean {
  // Must be a professional role
  if (!PROFESSIONAL_ROLES.includes(user.role as typeof PROFESSIONAL_ROLES[number])) {
    return false;
  }

  // Must be Pro tier or higher (PRO, STUDIO, or ENTERPRISE)
  const paidTiers = ['PRO', 'STUDIO', 'ENTERPRISE'];
  if (!paidTiers.includes(user.subscriptionTier)) {
    return false;
  }

  // Check subscription expiry (null = lifetime/founding designer)
  if (user.subscriptionExpiresAt && user.subscriptionExpiresAt < new Date()) {
    return false;
  }

  return true;
}

/**
 * Check if a vendor organization is eligible for the vendor directory
 * Requirements:
 * - Must be a vendor-type organization
 * - Must have PROFESSIONAL status (paid tier)
 */
export function isVendorDirectoryEligible(org: Pick<Organization, 'type' | 'status'>): boolean {
  const vendorTypes = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'];

  // Must be a vendor-type organization
  if (!vendorTypes.includes(org.type)) {
    return false;
  }

  // Must have PROFESSIONAL status
  if (org.status !== 'PROFESSIONAL') {
    return false;
  }

  return true;
}

/**
 * Get designer's directory eligibility status with details
 */
export async function getDesignerEligibilityStatus(userId: string): Promise<{
  isEligible: boolean;
  requiresProUpgrade: boolean;
  subscriptionTier: string;
  subscriptionExpiresAt: Date | null;
  role: string;
  inGracePeriod: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      subscriptionTier: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!user) {
    return {
      isEligible: false,
      requiresProUpgrade: true,
      subscriptionTier: 'FREE',
      subscriptionExpiresAt: null,
      role: 'INDIVIDUAL',
      inGracePeriod: false,
    };
  }

  const isEligible = isDesignerDirectoryEligible(user);
  const isProfessionalRole = PROFESSIONAL_ROLES.includes(user.role as typeof PROFESSIONAL_ROLES[number]);

  // Check grace period (7 days after subscription expires)
  let inGracePeriod = false;
  if (user.subscriptionExpiresAt) {
    const gracePeriodEnd = new Date(user.subscriptionExpiresAt);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    inGracePeriod = user.subscriptionExpiresAt < new Date() && new Date() < gracePeriodEnd;
  }

  return {
    isEligible: isEligible || inGracePeriod,
    requiresProUpgrade: isProfessionalRole && user.subscriptionTier === 'FREE',
    subscriptionTier: user.subscriptionTier,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    role: user.role,
    inGracePeriod,
  };
}

/**
 * Get vendor organization's directory eligibility status
 */
export async function getVendorEligibilityStatus(vendorOrgId: string): Promise<{
  isEligible: boolean;
  requiresProfessionalUpgrade: boolean;
  status: string;
  type: string;
}> {
  const org = await prisma.organization.findUnique({
    where: { id: vendorOrgId },
    select: {
      type: true,
      status: true,
    },
  });

  if (!org) {
    return {
      isEligible: false,
      requiresProfessionalUpgrade: true,
      status: 'UNCLAIMED',
      type: 'VENDOR',
    };
  }

  const isEligible = isVendorDirectoryEligible(org);
  const isVendorType = ['VENDOR', 'MANUFACTURER', 'SHOWROOM'].includes(org.type);

  return {
    isEligible,
    requiresProfessionalUpgrade: isVendorType && org.status !== 'PROFESSIONAL',
    status: org.status,
    type: org.type,
  };
}

/**
 * Calculate potential rank for non-eligible users (for conversion)
 * Shows them where they would rank if they upgraded to Pro
 */
export async function calculatePotentialRank(userId: string, totalScore: number): Promise<number | null> {
  // Count how many eligible designers have a higher score
  const higherRanked = await prisma.directoryRanking.count({
    where: {
      rankingType: 'DESIGNER',
      isEligible: true,
      isVisible: true,
      totalScore: { gt: totalScore },
    },
  });

  // Potential rank would be higherRanked + 1
  return higherRanked + 1;
}

/**
 * Update eligibility status for all designers
 * Called when subscription changes need to propagate
 */
export async function updateAllDesignerEligibility(): Promise<{ updated: number }> {
  // Get all designers with their current subscription status
  const designers = await prisma.user.findMany({
    where: {
      role: { in: ['DESIGNER', 'ARCHITECT', 'BUILDER'] },
    },
    select: {
      id: true,
      subscriptionTier: true,
      subscriptionExpiresAt: true,
      role: true,
      directoryRanking: {
        select: { id: true, isEligible: true },
      },
    },
  });

  let updated = 0;

  for (const designer of designers) {
    const isEligible = isDesignerDirectoryEligible(designer);

    if (designer.directoryRanking) {
      // Update existing ranking
      if (designer.directoryRanking.isEligible !== isEligible) {
        await prisma.directoryRanking.update({
          where: { id: designer.directoryRanking.id },
          data: { isEligible },
        });
        updated++;
      }
    } else if (isEligible) {
      // Create ranking for newly eligible designer
      await prisma.directoryRanking.create({
        data: {
          userId: designer.id,
          rankingType: 'DESIGNER',
          isEligible: true,
        },
      });
      updated++;
    }
  }

  return { updated };
}
