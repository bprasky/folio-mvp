/**
 * Rep Resolution Service
 *
 * Implements the resolution chain for finding the right vendor rep:
 * 1. OrgTerritoryAssignment (vendor assigned a rep to this designer's org)
 * 2. Vendor org OWNER/ADMIN/MANAGER members on Folio
 * 3. No rep found — client shows invite/email fallback
 */

import { prisma } from '@/lib/prisma';
import type { RepResolutionResult } from '@/types/structured-requests';

/**
 * Resolve the vendor rep for a given product and designer.
 *
 * Looks up product → brand → vendor org, then walks the resolution chain.
 */
export async function resolveVendorRep(
  designerUserId: string,
  productId: string
): Promise<RepResolutionResult> {
  // 1. Get product to find vendor org
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { brand: true, vendorId: true },
  });

  if (!product) {
    return { status: 'NO_REP' };
  }

  // Try to find vendor org via product.vendorId (user who owns the product)
  let vendorOrgId: string | null = null;
  let vendorOrgName: string | null = null;

  if (product.vendorId) {
    const vendorOrg = await prisma.organizationUser.findFirst({
      where: {
        userId: product.vendorId,
        organization: {
          type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
        },
      },
      select: {
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    if (vendorOrg) {
      vendorOrgId = vendorOrg.organizationId;
      vendorOrgName = vendorOrg.organization.name;
    }
  }

  // If no org via vendorId, try brand name match on organizations
  if (!vendorOrgId && product.brand) {
    const brandOrg = await prisma.organization.findFirst({
      where: {
        name: { equals: product.brand, mode: 'insensitive' },
        type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
      },
      select: { id: true, name: true },
    });

    if (brandOrg) {
      vendorOrgId = brandOrg.id;
      vendorOrgName = brandOrg.name;
    }
  }

  if (!vendorOrgId) {
    return {
      status: 'NO_REP',
      vendorOrgName: product.brand || undefined,
    };
  }

  // 2. Check OrgTerritoryAssignment for a rep assigned to this designer
  const designerOrg = await prisma.organizationUser.findFirst({
    where: { userId: designerUserId, isActive: true },
    select: { organizationId: true },
  });

  if (designerOrg) {
    const assignment = await prisma.orgTerritoryAssignment.findUnique({
      where: {
        vendorOrgId_designerOrgId: {
          vendorOrgId,
          designerOrgId: designerOrg.organizationId,
        },
      },
      select: {
        repUser: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    if (assignment?.repUser) {
      return {
        status: 'DIRECT_REP',
        rep: {
          userId: assignment.repUser.id,
          name: assignment.repUser.name,
          profileImage: assignment.repUser.profileImage,
        },
        vendorOrgId,
        vendorOrgName: vendorOrgName || undefined,
      };
    }
  }

  // 2b. Check imported contacts for a preferred rep at this vendor
  if (vendorOrgId) {
    const preferredContact = await prisma.designerContact.findFirst({
      where: {
        userId: designerUserId,
        vendorOrgId,
        isPreferredRep: true,
      },
      select: { name: true, email: true },
    });

    if (preferredContact) {
      // Return as a special status so the caller can send via Folio email
      return {
        status: 'NO_REP',
        vendorOrgId,
        vendorOrgName: vendorOrgName || undefined,
        preferredContact: {
          name: preferredContact.name,
          email: preferredContact.email,
        },
      };
    }
  }

  // 3. Fall back to vendor org members (OWNER/ADMIN/MANAGER)
  const orgMembers = await prisma.organizationUser.findMany({
    where: {
      organizationId: vendorOrgId,
      isActive: true,
      role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
    },
    select: {
      role: true,
      user: {
        select: { id: true, name: true, profileImage: true },
      },
    },
    take: 20,
  });

  if (orgMembers.length > 0) {
    // If exactly one member, treat as direct rep
    if (orgMembers.length === 1) {
      return {
        status: 'DIRECT_REP',
        rep: {
          userId: orgMembers[0].user.id,
          name: orgMembers[0].user.name,
          profileImage: orgMembers[0].user.profileImage,
        },
        vendorOrgId,
        vendorOrgName: vendorOrgName || undefined,
      };
    }

    return {
      status: 'ORG_MEMBERS',
      orgMembers: orgMembers.map(m => ({
        userId: m.user.id,
        name: m.user.name,
        role: m.role,
        profileImage: m.user.profileImage,
      })),
      vendorOrgId,
      vendorOrgName: vendorOrgName || undefined,
    };
  }

  // 4. No rep found
  return {
    status: 'NO_REP',
    vendorOrgId,
    vendorOrgName: vendorOrgName || undefined,
  };
}
