import { prisma } from '@/lib/prisma';

// Define PendingRepInviteStatus locally since it may not be in Prisma schema yet
const PendingRepInviteStatus = {
  PENDING: 'PENDING',
  CLAIMED: 'CLAIMED',
  EXPIRED: 'EXPIRED',
} as const;

/**
 * Auto-follow logic: When a rep is onboarded and linked to a vendor organization,
 * automatically follow all designers who have tagged that vendor organization.
 */
export async function autoFollowDesignersForRep(repUserId: string): Promise<void> {
  const repUser = await prisma.user.findUnique({
    where: { id: repUserId },
    select: {
      id: true,
      isVendorRep: true,
      vendorOrganizationId: true,
    },
  });

  if (!repUser || !repUser.isVendorRep || !repUser.vendorOrganizationId) {
    console.log('[RepAutoFollow] Skipping: user is not a rep or has no vendor org', {
      userId: repUserId,
      isVendorRep: repUser?.isVendorRep,
      vendorOrgId: repUser?.vendorOrganizationId,
    });
    return;
  }

  const orgId = repUser.vendorOrganizationId;

  // Find designers from pending invites
  const invites = await prisma.pendingRepInvite.findMany({
    where: {
      vendorOrganizationId: orgId,
      status: PendingRepInviteStatus.PENDING,
    },
    select: { designerId: true },
  });

  // Find designers from product tags (via projects)
  // Get all users in this vendor org, then find their products
  const orgUsers = await prisma.organizationUser.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
    },
    select: { userId: true },
  });

  const vendorUserIds = orgUsers.map((ou) => ou.userId);

  // Find products from these vendor users
  const vendorProducts = await prisma.product.findMany({
    where: {
      vendorId: { in: vendorUserIds },
    },
    select: { id: true },
  });

  const productIds = vendorProducts.map((p) => p.id);

  // Find projects that have tagged these products
  const tags = productIds.length > 0 ? await prisma.productTag.findMany({
    where: {
      productId: { in: productIds },
    },
    include: {
      image: {
        include: {
          project: {
            select: { designerId: true },
          },
        },
      },
    },
  }) : [];

  // Also check projects directly linked to vendor org
  const vendorProjects = await prisma.project.findMany({
    where: {
      vendorOrgId: orgId,
    },
    select: { designerId: true },
  });

  // Collect unique designer IDs
  const designerIds = new Set<string>();

  // From invites
  invites.forEach((inv) => {
    if (inv.designerId) {
      designerIds.add(inv.designerId);
    }
  });

  // From product tags
  tags.forEach((tag) => {
    if (tag.image.project.designerId) {
      designerIds.add(tag.image.project.designerId);
    }
  });

  // From vendor projects
  vendorProjects.forEach((proj) => {
    if (proj.designerId) {
      designerIds.add(proj.designerId);
    }
  });

  // Remove the rep's own ID if somehow included
  designerIds.delete(repUserId);

  if (designerIds.size === 0) {
    console.log('[RepAutoFollow] No designers found to follow for org', orgId);
    return;
  }

  // Create follow relationships (upsert to avoid duplicates)
  const followOperations = Array.from(designerIds).map((designerId) =>
    prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: repUserId,
          followingId: designerId,
        },
      },
      update: {}, // No update needed if already exists
      create: {
        followerId: repUserId,
        followingId: designerId,
      },
    })
  );

  await prisma.$transaction(followOperations);

  console.log('[RepAutoFollow] Successfully auto-followed designers', {
    repUserId,
    orgId,
    designerCount: designerIds.size,
  });
}

