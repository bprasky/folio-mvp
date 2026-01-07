import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/events/[id]/invites/targeting
 * Generate targeted invite list using graph-based targeting
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      targetRoles,
      targetSpecialties,
      targetLocations,
      targetBudgetRanges,
      targetProjectStages,
      minEngagementScore,
      minProximityScore,
      limit = 100,
    } = body;

    // Get or create host profile
    let hostProfile = await prisma.eventHostProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!hostProfile) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      hostProfile = await prisma.eventHostProfile.create({
        data: {
          userId: session.user.id,
          hostName: user.name,
          hostEmail: user.email,
          hostPhone: user.phone,
          hostCompany: user.companyName,
          hostTitle: user.title,
        },
      });
    }

    // Build query filters
    const where: any = {};

    if (targetRoles && targetRoles.length > 0) {
      where.role = { in: targetRoles };
    }

    if (targetSpecialties && targetSpecialties.length > 0) {
      where.specialties = { hasSome: targetSpecialties };
    }

    if (targetLocations && targetLocations.length > 0) {
      where.location = { in: targetLocations };
    }

    if (targetBudgetRanges && targetBudgetRanges.length > 0) {
      where.budgetRange = { in: targetBudgetRanges };
    }

    // Query designers matching criteria
    let designers = await prisma.user.findMany({
      where: {
        ...where,
        role: 'DESIGNER',
      },
      take: limit * 2, // Get more to filter by scores
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
        location: true,
        specialties: true,
        budgetRange: true,
        designerActivityProfile: {
          select: {
            eventEngagementScore: true,
            productEngagementScore: true,
            proximityToPurchaseScore: true,
            lifecycleScore: true,
          },
        },
        proximityToPurchaseIndicator: {
          select: {
            proximityScore: true,
          },
        },
      },
    });

    // Filter by engagement and proximity scores if provided
    if (minEngagementScore !== undefined || minProximityScore !== undefined) {
      designers = designers.filter((designer) => {
        const activityProfile = designer.designerActivityProfile;
        const proximityIndicator = designer.proximityToPurchaseIndicator;

        if (minEngagementScore !== undefined && activityProfile) {
          const avgEngagement =
            (activityProfile.eventEngagementScore +
              activityProfile.productEngagementScore) /
            2;
          if (avgEngagement < minEngagementScore) {
            return false;
          }
        }

        if (minProximityScore !== undefined && proximityIndicator) {
          if (proximityIndicator.proximityScore < minProximityScore) {
            return false;
          }
        }

        return true;
      });
    }

    // Limit results
    designers = designers.slice(0, limit);

    // Convert to contact format
    const contacts = designers.map((designer) => ({
      email: designer.email,
      name: designer.name,
      userId: designer.id,
      role: 'DESIGNER',
      engagementScore:
        designer.designerActivityProfile?.eventEngagementScore || 0,
      proximityScore:
        designer.proximityToPurchaseIndicator?.proximityScore || 0,
    }));

    // Save targeting profile if criteria provided
    if (
      targetRoles ||
      targetSpecialties ||
      targetLocations ||
      targetBudgetRanges ||
      targetProjectStages
    ) {
      await prisma.eventTargetingProfile.create({
        data: {
          hostProfileId: hostProfile.id,
          targetRoles: targetRoles || [],
          targetSpecialties: targetSpecialties || [],
          targetLocations: targetLocations || [],
          targetBudgetRanges: targetBudgetRanges || [],
          targetProjectStages: targetProjectStages || [],
          minEngagementScore: minEngagementScore || null,
          minProximityScore: minProximityScore || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      contacts,
      count: contacts.length,
      criteria: {
        targetRoles,
        targetSpecialties,
        targetLocations,
        targetBudgetRanges,
        targetProjectStages,
        minEngagementScore,
        minProximityScore,
      },
    });
  } catch (error: any) {
    console.error('Error generating targeted invites:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}




