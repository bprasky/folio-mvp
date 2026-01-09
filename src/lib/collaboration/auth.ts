/**
 * Authorization helpers for Collaboration Stories
 */

import { prisma } from '@/lib/prisma';

export type VendorTierInfo = {
  tier: 'FREE' | 'PLUS' | 'PRO' | null;
  orgId: string;
  orgName: string;
  canCreateCollaborations: boolean;
};

/**
 * Get the vendor context for a user, including their organization and tier
 */
export async function getVendorContext(userId: string): Promise<VendorTierInfo | null> {
  // Find the user's active vendor organization membership
  const membership = await prisma.organizationUser.findFirst({
    where: {
      userId,
      isActive: true,
      organization: {
        type: 'VENDOR',
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          vendorTier: true,
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  const tier = membership.organization.vendorTier as 'FREE' | 'PLUS' | 'PRO' | null;

  return {
    tier,
    orgId: membership.organization.id,
    orgName: membership.organization.name,
    // Pro+ means PLUS or PRO tier can create collaboration stories
    canCreateCollaborations: tier === 'PLUS' || tier === 'PRO',
  };
}

/**
 * Assert that a user has vendor Pro+ access
 * Throws if the user doesn't have sufficient tier
 */
export async function assertVendorTier(
  userId: string,
  requiredTiers: ('PLUS' | 'PRO')[] = ['PLUS', 'PRO']
): Promise<VendorTierInfo> {
  const context = await getVendorContext(userId);

  if (!context) {
    throw new Error('NotVendor: User is not part of a vendor organization');
  }

  if (!context.tier) {
    throw new Error('NoTier: Vendor organization has no tier assigned');
  }

  if (!requiredTiers.includes(context.tier as 'PLUS' | 'PRO')) {
    throw new Error(`InsufficientTier: Requires ${requiredTiers.join(' or ')} tier`);
  }

  return context;
}

/**
 * Check if a user can access a specific collaboration story
 */
export async function canAccessCollaborationStory(
  userId: string,
  storyId: string
): Promise<{ canView: boolean; canEdit: boolean; role: 'vendor' | 'designer' | 'admin' | null }> {
  // First check if user is an admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'ADMIN') {
    return { canView: true, canEdit: true, role: 'admin' };
  }

  // Get the story
  const story = await prisma.collaborationStory.findUnique({
    where: { id: storyId },
    select: {
      vendorOrgId: true,
      designerUserId: true,
      status: true,
    },
  });

  if (!story) {
    return { canView: false, canEdit: false, role: null };
  }

  // Check if user is the designer
  if (story.designerUserId === userId) {
    return { canView: true, canEdit: true, role: 'designer' };
  }

  // Check if user is part of the vendor organization
  const vendorMembership = await prisma.organizationUser.findFirst({
    where: {
      userId,
      organizationId: story.vendorOrgId,
      isActive: true,
    },
  });

  if (vendorMembership) {
    return { canView: true, canEdit: true, role: 'vendor' };
  }

  // Published stories can be viewed by anyone
  if (story.status === 'PUBLISHED') {
    return { canView: true, canEdit: false, role: null };
  }

  return { canView: false, canEdit: false, role: null };
}

/**
 * Assert user can view a collaboration story
 */
export async function assertCollaborationStoryView(
  userId: string,
  storyId: string
): Promise<{ role: 'vendor' | 'designer' | 'admin' | null }> {
  const access = await canAccessCollaborationStory(userId, storyId);

  if (!access.canView) {
    throw new Error('Forbidden: Cannot view this collaboration story');
  }

  return { role: access.role };
}

/**
 * Assert user can edit a collaboration story
 */
export async function assertCollaborationStoryEdit(
  userId: string,
  storyId: string
): Promise<{ role: 'vendor' | 'designer' | 'admin' }> {
  const access = await canAccessCollaborationStory(userId, storyId);

  if (!access.canEdit || !access.role) {
    throw new Error('Forbidden: Cannot edit this collaboration story');
  }

  return { role: access.role };
}

/**
 * Generate a unique slug for a collaboration story
 */
export function generateCollaborationSlug(vendorName: string, designerName: string): string {
  const slugify = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

  const vendorSlug = slugify(vendorName);
  const designerSlug = slugify(designerName);
  const timestamp = Date.now().toString(36);

  return `${vendorSlug}-x-${designerSlug}-${timestamp}`;
}
