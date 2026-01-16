/**
 * Subscription Service
 *
 * Business logic for managing user subscriptions, feature access,
 * and subscription lifecycle events.
 */

import { prisma } from '@/lib/prisma';
import {
  getTierConfig,
  getTierLimit,
  hasFeature,
  isPaidTier,
  isTeamTier,
  getNextUpgradeTier,
  type SubscriptionTierType,
} from './tiers';
import type {
  SubscriptionStatus,
  UserSubscription,
  SubscriptionUsage,
  FeatureAccessResult,
  TierComparison,
  UpgradePromptData,
  UpgradeTrigger,
} from './types';

// Grace period in days after subscription expires
const GRACE_PERIOD_DAYS = 7;

/**
 * Get a user's current subscription status
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionExpiresAt: true,
    },
  });

  if (!user) {
    return {
      tier: 'FREE',
      isActive: true,
      expiresAt: null,
      isFoundingDesigner: false,
      inGracePeriod: false,
      daysUntilExpiry: null,
    };
  }

  const tier = user.subscriptionTier as SubscriptionTierType;
  const expiresAt = user.subscriptionExpiresAt;
  const now = new Date();

  // Founding designers have null expiry date (lifetime access)
  const isFoundingDesigner = isPaidTier(tier) && expiresAt === null;

  // Calculate if subscription is expired
  let isExpired = false;
  let inGracePeriod = false;
  let daysUntilExpiry: number | null = null;

  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    isExpired = expiryDate < now;

    if (!isExpired) {
      daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
    } else {
      // Check grace period
      const gracePeriodEnd = new Date(expiryDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);
      inGracePeriod = now < gracePeriodEnd;
    }
  }

  const isActive = !isExpired || inGracePeriod;

  return {
    tier,
    isActive,
    expiresAt,
    isFoundingDesigner,
    inGracePeriod,
    daysUntilExpiry,
  };
}

/**
 * Get full subscription details including config and limits
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const status = await getSubscriptionStatus(userId);
  const config = getTierConfig(status.tier);

  return {
    userId,
    status,
    config,
    limits: config.limits,
  };
}

/**
 * Get subscription with usage statistics
 */
export async function getUserSubscriptionWithUsage(userId: string): Promise<UserSubscription> {
  const subscription = await getUserSubscription(userId);
  const usage = await getSubscriptionUsage(userId, subscription.status.tier);

  return {
    ...subscription,
    usage,
  };
}

/**
 * Get current usage against subscription limits
 */
export async function getSubscriptionUsage(
  userId: string,
  tier: SubscriptionTierType
): Promise<SubscriptionUsage> {
  const limits = getTierConfig(tier).limits;

  // Get project count
  const projectCount = await prisma.project.count({
    where: {
      OR: [{ ownerId: userId }, { designerId: userId }],
    },
  });

  // Get designer seats (for team tiers)
  let seatCount = 1;
  if (isTeamTier(tier)) {
    // For team tiers, count org members
    const orgMembership = await prisma.organizationUser.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      include: {
        organization: {
          include: {
            users: {
              where: { isActive: true },
            },
          },
        },
      },
    });
    seatCount = orgMembership?.organization.users.length ?? 1;
  }

  // Calculate AI generation usage (monthly reset)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Placeholder for AI generation tracking (would need actual tracking table)
  const aiGenerationsThisMonth = 0;

  // Calculate storage usage (placeholder - would need actual calculation)
  const storageUsedGb = 0;

  return {
    projects: {
      count: projectCount,
      limit: limits.projects,
      percentUsed: limits.projects ? Math.round((projectCount / limits.projects) * 100) : null,
    },
    moodboards: {
      count: 0, // Would need actual count
      limit: limits.moodboards,
      percentUsed: null,
    },
    designerSeats: {
      count: seatCount,
      limit: limits.designerSeats,
      percentUsed:
        limits.designerSeats > 0 ? Math.round((seatCount / limits.designerSeats) * 100) : null,
    },
    aiGenerations: {
      count: aiGenerationsThisMonth,
      limit: limits.aiEditorialGenerationsPerMonth,
      percentUsed: limits.aiEditorialGenerationsPerMonth
        ? Math.round((aiGenerationsThisMonth / limits.aiEditorialGenerationsPerMonth) * 100)
        : null,
      resetsAt: nextMonth,
    },
    storageGb: {
      used: storageUsedGb,
      limit: limits.storageGb,
      percentUsed: limits.storageGb > 0 ? Math.round((storageUsedGb / limits.storageGb) * 100) : 0,
    },
  };
}

/**
 * Check if user can access a specific feature
 */
export async function checkFeatureAccess(
  userId: string,
  featureKey: string
): Promise<FeatureAccessResult> {
  const status = await getSubscriptionStatus(userId);

  const canAccess = status.isActive && hasFeature(status.tier, featureKey);

  // Find minimum tier for this feature
  const tiers: SubscriptionTierType[] = ['FREE', 'PRO', 'STUDIO', 'ENTERPRISE'];
  let minimumTier: SubscriptionTierType | null = null;
  for (const tier of tiers) {
    if (hasFeature(tier, featureKey)) {
      minimumTier = tier;
      break;
    }
  }

  return {
    hasAccess: canAccess,
    featureKey,
    currentTier: status.tier,
    minimumTierRequired: minimumTier,
    upgradeRequired: !canAccess && minimumTier !== null,
    upgradeUrl: !canAccess ? '/pricing' : undefined,
  };
}

/**
 * Check if user has reached a limit
 */
export async function checkLimit(
  userId: string,
  limitKey: 'projects' | 'moodboards' | 'designerSeats'
): Promise<{
  isAtLimit: boolean;
  current: number;
  limit: number | null;
  upgradeRequired: boolean;
}> {
  const subscription = await getUserSubscriptionWithUsage(userId);
  const usage = subscription.usage;

  if (!usage) {
    return {
      isAtLimit: false,
      current: 0,
      limit: null,
      upgradeRequired: false,
    };
  }

  const limitValue = subscription.limits[limitKey];
  let currentValue = 0;

  switch (limitKey) {
    case 'projects':
      currentValue = usage.projects.count;
      break;
    case 'moodboards':
      currentValue = usage.moodboards.count;
      break;
    case 'designerSeats':
      currentValue = usage.designerSeats.count;
      break;
  }

  const isUnlimited = limitValue === null || limitValue === -1;
  const isAtLimit = !isUnlimited && currentValue >= (limitValue ?? 0);

  return {
    isAtLimit,
    current: currentValue,
    limit: limitValue,
    upgradeRequired: isAtLimit,
  };
}

/**
 * Generate upgrade prompt data based on trigger
 */
export function getUpgradePrompt(
  currentTier: SubscriptionTierType,
  trigger: UpgradeTrigger
): UpgradePromptData | null {
  const nextTier = getNextUpgradeTier(currentTier);
  if (!nextTier) return null;

  const messages: Record<UpgradeTrigger, { message: string; cta: string }> = {
    project_limit_reached: {
      message: 'You\'ve reached your project limit. Upgrade to create unlimited projects.',
      cta: 'Unlock unlimited projects',
    },
    ai_generation_limit_reached: {
      message: 'You\'ve used all your AI generations this month. Upgrade for unlimited access.',
      cta: 'Get unlimited AI generations',
    },
    team_feature_requested: {
      message: 'Team features are available on Studio and Enterprise plans.',
      cta: 'Add your team',
    },
    client_collaboration_requested: {
      message: 'Client collaboration is available on Pro and higher plans.',
      cta: 'Collaborate with clients',
    },
    analytics_requested: {
      message: 'Analytics are available on Pro and higher plans.',
      cta: 'Unlock analytics',
    },
    directory_listing_requested: {
      message: 'Get listed in the designer directory with a Pro subscription.',
      cta: 'Get discovered',
    },
    affiliate_program_requested: {
      message: 'Earn from product sales with a Pro subscription.',
      cta: 'Start earning',
    },
    manual_upgrade: {
      message: 'Upgrade to unlock more features.',
      cta: 'View plans',
    },
  };

  const { message, cta } = messages[trigger];

  return {
    trigger,
    currentTier,
    recommendedTier: nextTier,
    message,
    ctaText: cta,
    ctaUrl: `/pricing?from=${currentTier}&to=${nextTier}`,
  };
}

/**
 * Compare two tiers for upgrade flow
 */
export function compareTiers(
  currentTier: SubscriptionTierType,
  targetTier: SubscriptionTierType
): TierComparison {
  const currentConfig = getTierConfig(currentTier);
  const targetConfig = getTierConfig(targetTier);

  // Find features in target not in current
  const additionalFeatures: string[] = [];
  const allFeatureKeys = [
    'unlimited_projects',
    'ai_editorial',
    'client_collaboration',
    'analytics',
    'directory_listing',
    'affiliate_revenue',
    'team_seats',
    'shared_libraries',
    'firm_analytics',
    'api_integrations',
    'dedicated_account_manager',
  ];

  for (const featureKey of allFeatureKeys) {
    if (hasFeature(targetTier, featureKey) && !hasFeature(currentTier, featureKey)) {
      additionalFeatures.push(featureKey);
    }
  }

  // Compare limits
  const limitKeys: (keyof typeof currentConfig.limits)[] = [
    'projects',
    'moodboards',
    'designerSeats',
    'storageGb',
  ];

  const limitImprovements = limitKeys
    .filter((key) => currentConfig.limits[key] !== targetConfig.limits[key])
    .map((key) => ({
      limitKey: key,
      current: currentConfig.limits[key],
      new: targetConfig.limits[key],
    }));

  // Calculate price difference
  const currentMonthly = currentConfig.pricing?.monthly ?? 0;
  const targetMonthly = targetConfig.pricing?.monthly ?? 0;
  const currentAnnually = currentConfig.pricing?.annually ?? 0;
  const targetAnnually = targetConfig.pricing?.annually ?? 0;

  return {
    currentTier: currentConfig,
    targetTier: targetConfig,
    additionalFeatures,
    limitImprovements,
    priceDifference: {
      monthly: targetMonthly - currentMonthly,
      annually: targetAnnually - currentAnnually,
    },
  };
}

/**
 * Update user's subscription tier
 */
export async function updateSubscriptionTier(
  userId: string,
  newTier: SubscriptionTierType,
  expiresAt?: Date | null
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: newTier,
      subscriptionExpiresAt: expiresAt,
    },
  });
}

/**
 * Check if user can create a new project
 */
export async function canCreateProject(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}> {
  const limitCheck = await checkLimit(userId, 'projects');

  if (limitCheck.isAtLimit) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limitCheck.limit} project${
        limitCheck.limit === 1 ? '' : 's'
      }. Upgrade to Pro for unlimited projects.`,
      upgradeRequired: true,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can invite a team member
 */
export async function canInviteTeamMember(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}> {
  const subscription = await getUserSubscription(userId);

  if (!isTeamTier(subscription.status.tier)) {
    return {
      allowed: false,
      reason: 'Team features are available on Studio and Enterprise plans.',
      upgradeRequired: true,
    };
  }

  const limitCheck = await checkLimit(userId, 'designerSeats');

  if (limitCheck.isAtLimit) {
    return {
      allowed: false,
      reason: `You've reached your limit of ${limitCheck.limit} designer seats.`,
      upgradeRequired: true,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can access AI editorial generation
 */
export async function canUseAIEditorial(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}> {
  const featureAccess = await checkFeatureAccess(userId, 'ai_editorial');

  if (!featureAccess.hasAccess) {
    return {
      allowed: false,
      reason: 'AI editorial generation is available on Pro and higher plans.',
      upgradeRequired: true,
    };
  }

  return { allowed: true };
}
