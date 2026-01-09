import prisma from '@/lib/prisma';

// Configurable engagement thresholds for Product Spotlight
const ENGAGEMENT_THRESHOLDS = {
  minViews: 500,
  minSaves: 50,
  minShares: 20,
  // Project must meet at least 2 of these thresholds
  minThresholdsToMeet: 2,
};

export interface ProjectEngagementMetrics {
  views: number;
  saves: number;
  shares: number;
  thresholdsMet: number;
}

export interface FeatureInvitationResult {
  eligible: boolean;
  reason?: string;
  projectId: string;
  designerId?: string;
  metrics?: ProjectEngagementMetrics;
}

/**
 * Check if a project has reached engagement thresholds for Feature promotion.
 * Used to determine if a designer should be invited to create a Product Spotlight Feature.
 */
export async function checkProjectForFeatureEligibility(
  projectId: string
): Promise<FeatureInvitationResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      designerId: true,
      isPublic: true,
      publishedAt: true,
      views: true,
      saves: true,
      shares: true,
      features: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!project) {
    return {
      eligible: false,
      reason: 'Project not found',
      projectId,
    };
  }

  if (!project.isPublic || !project.publishedAt) {
    return {
      eligible: false,
      reason: 'Project must be published to be eligible for Feature',
      projectId,
    };
  }

  if (!project.designerId) {
    return {
      eligible: false,
      reason: 'Project must have an assigned designer',
      projectId,
    };
  }

  // Check if a Feature already exists for this project
  if (project.features.length > 0) {
    return {
      eligible: false,
      reason: 'A Feature already exists for this project',
      projectId,
      designerId: project.designerId,
    };
  }

  // Calculate engagement metrics
  const metrics: ProjectEngagementMetrics = {
    views: project.views,
    saves: project.saves,
    shares: project.shares,
    thresholdsMet: 0,
  };

  if (project.views >= ENGAGEMENT_THRESHOLDS.minViews) {
    metrics.thresholdsMet++;
  }
  if (project.saves >= ENGAGEMENT_THRESHOLDS.minSaves) {
    metrics.thresholdsMet++;
  }
  if (project.shares >= ENGAGEMENT_THRESHOLDS.minShares) {
    metrics.thresholdsMet++;
  }

  const eligible =
    metrics.thresholdsMet >= ENGAGEMENT_THRESHOLDS.minThresholdsToMeet;

  return {
    eligible,
    reason: eligible
      ? undefined
      : `Project needs to meet at least ${ENGAGEMENT_THRESHOLDS.minThresholdsToMeet} engagement thresholds`,
    projectId,
    designerId: project.designerId,
    metrics,
  };
}

/**
 * Trigger a Feature invitation for a designer based on project performance.
 * This would typically send an email or in-app notification.
 *
 * @returns The result of the invitation attempt
 */
export async function triggerFeatureInvitation(
  projectId: string
): Promise<{
  success: boolean;
  message: string;
  designerId?: string;
}> {
  const eligibility = await checkProjectForFeatureEligibility(projectId);

  if (!eligibility.eligible) {
    return {
      success: false,
      message: eligibility.reason || 'Project not eligible for Feature',
    };
  }

  // Get designer details for notification
  const designer = await prisma.user.findUnique({
    where: { id: eligibility.designerId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!designer) {
    return {
      success: false,
      message: 'Designer not found',
    };
  }

  // TODO: Send notification to designer
  // This could be an email, in-app notification, or push notification
  // For now, we just return success and let the API layer handle notification

  return {
    success: true,
    message: `Designer ${designer.name} invited to create Product Spotlight Feature`,
    designerId: designer.id,
  };
}

/**
 * Batch check projects for Feature eligibility.
 * Useful for scheduled jobs that scan for elevated projects.
 */
export async function scanProjectsForFeatureEligibility(
  limit: number = 100
): Promise<FeatureInvitationResult[]> {
  // Find published projects that don't have Features yet
  // and have some minimum engagement
  const projects = await prisma.project.findMany({
    where: {
      isPublic: true,
      publishedAt: { not: null },
      designerId: { not: null },
      features: { none: {} },
      OR: [
        { views: { gte: Math.floor(ENGAGEMENT_THRESHOLDS.minViews * 0.5) } },
        { saves: { gte: Math.floor(ENGAGEMENT_THRESHOLDS.minSaves * 0.5) } },
        { shares: { gte: Math.floor(ENGAGEMENT_THRESHOLDS.minShares * 0.5) } },
      ],
    },
    select: {
      id: true,
    },
    take: limit,
    orderBy: [{ views: 'desc' }, { saves: 'desc' }],
  });

  const results: FeatureInvitationResult[] = [];

  for (const project of projects) {
    const eligibility = await checkProjectForFeatureEligibility(project.id);
    results.push(eligibility);
  }

  return results;
}
