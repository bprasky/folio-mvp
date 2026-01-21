/**
 * Boost Opportunity Creation
 *
 * Creates boost opportunities when a designer gives a positive vendor mention
 * in an interview answer. These opportunities are then presented to vendors
 * who can choose to boost the testimonial for prominent placement.
 */

import { prisma } from '@/lib/prisma';
import type { AnswerAnalysis } from '@/lib/interview/answerAnalysis';
import type { BoostOpportunity, Organization, Prisma } from '@prisma/client';

export interface CreateBoostOpportunityParams {
  projectId: string;
  designerId: string;
  questionId: string;
  answer: string;
  analysis: AnswerAnalysis;
}

/**
 * Create boost opportunities for all positively mentioned vendors in an answer
 */
export async function createBoostOpportunities(
  params: CreateBoostOpportunityParams
): Promise<BoostOpportunity[]> {
  const { projectId, designerId, questionId, answer, analysis } = params;

  // Only create opportunities for boost-eligible answers
  if (!analysis.boost_eligible) {
    return [];
  }

  const opportunities: BoostOpportunity[] = [];

  // Create opportunity for each vendor mentioned positively
  for (const vendorName of analysis.vendors_mentioned) {
    try {
      // Find vendor organization by name (case-insensitive)
      const vendor = await prisma.organization.findFirst({
        where: {
          OR: [
            { name: { equals: vendorName, mode: 'insensitive' } },
          ],
          type: 'VENDOR',
        },
      });

      if (!vendor) {
        // Vendor not on platform yet - create invite signal
        await createVendorInviteSignal(vendorName, projectId, designerId);
        continue;
      }

      // Check if opportunity already exists for this vendor + project + question
      const existing = await prisma.boostOpportunity.findFirst({
        where: {
          projectId,
          vendorId: vendor.id,
          questionId,
          status: { in: ['PENDING', 'NOTIFIED', 'VIEWED'] },
        },
      });

      if (existing) {
        // Update existing with better quote if applicable
        if (
          analysis.suggested_pull_quote &&
          analysis.suggested_pull_quote.length > (existing.suggestedPullQuote?.length || 0)
        ) {
          await prisma.boostOpportunity.update({
            where: { id: existing.id },
            data: {
              suggestedPullQuote: analysis.suggested_pull_quote,
              fullAnswer: answer,
            },
          });
        }
        continue;
      }

      // Create new opportunity
      const opportunity = await prisma.boostOpportunity.create({
        data: {
          projectId,
          designerId,
          questionId,
          vendorId: vendor.id,
          fullAnswer: answer,
          suggestedPullQuote: analysis.suggested_pull_quote || null,
          productIds: analysis.products_mentioned,
          sentiment: analysis.overall_sentiment,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      });

      opportunities.push(opportunity);
    } catch (error) {
      console.error(`[createBoostOpportunities] Error creating opportunity for ${vendorName}:`, error);
      // Continue with other vendors
    }
  }

  return opportunities;
}

/**
 * Create a signal for vendors not yet on the platform
 * This can be used for outreach later
 */
async function createVendorInviteSignal(
  vendorName: string,
  projectId: string,
  designerId: string
): Promise<void> {
  try {
    // Check if we already have a recent signal for this vendor
    const existingSignal = await prisma.vendorInviteSignal.findFirst({
      where: {
        vendorName: { equals: vendorName, mode: 'insensitive' },
        signalType: 'TESTIMONIAL_AVAILABLE',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
    });

    if (existingSignal) {
      // Don't create duplicate signals
      return;
    }

    await prisma.vendorInviteSignal.create({
      data: {
        vendorName,
        signalType: 'TESTIMONIAL_AVAILABLE',
        projectId,
        designerId,
        metadata: {
          reason: 'Designer provided positive testimonial in interview',
        },
      },
    });
  } catch (error) {
    console.error(`[createVendorInviteSignal] Error creating signal for ${vendorName}:`, error);
  }
}

/**
 * Get pending boost opportunities for a vendor
 */
export async function getVendorPendingOpportunities(
  vendorId: string
): Promise<BoostOpportunity[]> {
  return prisma.boostOpportunity.findMany({
    where: {
      vendorId,
      status: { in: ['PENDING', 'NOTIFIED', 'VIEWED'] },
      expiresAt: { gt: new Date() },
    },
    include: {
      designer: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          title: true,
          location: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          images: {
            take: 1,
            orderBy: { displayOrder: 'asc' },
            select: { url: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get boost opportunity details for vendor review
 */
export async function getBoostOpportunityForReview(opportunityId: string) {
  return prisma.boostOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      vendor: {
        include: {
          vendorSubscription: {
            select: { tier: true, status: true },
          },
        },
      },
      designer: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          title: true,
          location: true,
        },
      },
      project: {
        include: {
          images: {
            take: 6,
            orderBy: { displayOrder: 'asc' },
          },
          rooms: {
            include: {
              selections: {
                include: {
                  productTag: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      boost: true,
    },
  });
}

/**
 * Check if a vendor can boost (has paid subscription)
 */
export function canVendorBoost(vendor: Organization & {
  vendorSubscription?: { tier: string; status: string } | null
}): boolean {
  if (!vendor.vendorSubscription) {
    return false;
  }

  const { tier, status } = vendor.vendorSubscription;

  // Only active paid tiers can boost
  if (status !== 'ACTIVE' && status !== 'TRIALING') {
    return false;
  }

  // STARTER tier cannot boost, PROFESSIONAL and ENTERPRISE can
  return tier !== 'STARTER';
}

/**
 * Mark an opportunity as viewed
 */
export async function markOpportunityViewed(opportunityId: string): Promise<void> {
  const opportunity = await prisma.boostOpportunity.findUnique({
    where: { id: opportunityId },
  });

  if (opportunity?.status === 'NOTIFIED') {
    await prisma.boostOpportunity.update({
      where: { id: opportunityId },
      data: {
        status: 'VIEWED',
        viewedAt: new Date(),
      },
    });
  }
}

/**
 * Count active boost opportunities for a vendor (for dashboard badges)
 */
export async function countVendorActiveOpportunities(vendorId: string): Promise<number> {
  return prisma.boostOpportunity.count({
    where: {
      vendorId,
      status: { in: ['PENDING', 'NOTIFIED', 'VIEWED'] },
      expiresAt: { gt: new Date() },
    },
  });
}
