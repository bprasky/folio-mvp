import prisma from '@/lib/prisma';
import { FeatureType, FeatureBadge, FeatureStatus } from '@prisma/client';

/**
 * Interface for CollaborationStory data.
 * This is a placeholder until the CollaborationStory model is implemented.
 * Collaboration Stories document designer-vendor partnerships.
 */
export interface CollaborationStoryData {
  id: string;
  title: string;
  designerId: string;
  vendorOrgIds: string[];
  content?: unknown;
  heroImageUrl?: string;
  excerpt?: string;
  publishedAt?: Date;
}

export interface PromotionResult {
  success: boolean;
  featureId?: string;
  message: string;
}

/**
 * Generates a URL-safe slug from a title.
 */
function generateSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

/**
 * Promotes a Collaboration Story to a Feature automatically on publish.
 * Collaboration Stories become Features with the COLLABORATION type.
 *
 * This function is meant to be called when a CollaborationStory is published.
 *
 * @param storyData - The collaboration story data to promote
 * @returns The result of the promotion
 */
export async function promoteCollaborationToFeature(
  storyData: CollaborationStoryData
): Promise<PromotionResult> {
  // Validate required fields
  if (!storyData.id || !storyData.title || !storyData.designerId) {
    return {
      success: false,
      message: 'Missing required collaboration story fields',
    };
  }

  // Check if story is published
  if (!storyData.publishedAt) {
    return {
      success: false,
      message: 'Collaboration Story must be published before promotion',
    };
  }

  // Check if a Feature already exists for this collaboration story
  const existingFeature = await prisma.feature.findFirst({
    where: { collaborationStoryId: storyData.id },
  });

  if (existingFeature) {
    return {
      success: false,
      featureId: existingFeature.id,
      message: 'A Feature already exists for this Collaboration Story',
    };
  }

  // Create the Feature
  const feature = await prisma.feature.create({
    data: {
      slug: generateSlug(storyData.title),
      type: FeatureType.COLLABORATION,
      collaborationStoryId: storyData.id,
      primaryAuthorId: storyData.designerId,
      title: storyData.title,
      excerpt: storyData.excerpt,
      heroImageUrl: storyData.heroImageUrl,
      content: storyData.content as object,
      status: FeatureStatus.PUBLISHED,
      badgeType: FeatureBadge.COLLABORATION,
      publishedAt: storyData.publishedAt,
      // Enable vendor contributions for tagged vendors
      allowVendorContributions: true,
      vendorContributionMode: 'SELECTED',
      allowedVendorIds: storyData.vendorOrgIds,
    },
  });

  // Create contribution invitations for participating vendors
  if (storyData.vendorOrgIds.length > 0) {
    await prisma.featureVendorContribution.createMany({
      data: storyData.vendorOrgIds.map((vendorOrgId) => ({
        featureId: feature.id,
        vendorOrgId,
        qualificationType: 'TAGGED',
        status: 'INVITED',
      })),
      skipDuplicates: true,
    });
  }

  return {
    success: true,
    featureId: feature.id,
    message: 'Collaboration Story promoted to Feature successfully',
  };
}

/**
 * Stub function for future implementation.
 * Will be called automatically when a CollaborationStory is published.
 *
 * For now, this serves as documentation of the intended behavior.
 */
export async function onCollaborationStoryPublish(
  collaborationStoryId: string
): Promise<PromotionResult> {
  // TODO: Implement once CollaborationStory model exists
  // This would:
  // 1. Fetch the CollaborationStory by ID
  // 2. Extract the required fields
  // 3. Call promoteCollaborationToFeature

  return {
    success: false,
    message:
      'CollaborationStory model not yet implemented. This function is a placeholder.',
  };
}

/**
 * Helper to extract vendor organization IDs from collaboration story participants.
 * This would be used when the CollaborationStory model is implemented.
 */
export function extractVendorOrgIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  participants: Array<{ orgId?: string; role?: string }>
): string[] {
  return participants
    .filter((p) => p.orgId && p.role === 'VENDOR')
    .map((p) => p.orgId as string);
}
