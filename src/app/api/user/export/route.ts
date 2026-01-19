export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GDPR Article 20: Right to Data Portability
 * Export all user data in machine-readable format (JSON)
 *
 * GET /api/user/export
 * Returns comprehensive JSON export of all user data
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all user data in parallel for performance
    const [user, projects, contextSignals, atelierSignals, orders, creditAccount, eventRSVPs, orgMemberships] = await Promise.all([
      // Core user profile (excluding passwordHash for security)
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          bio: true,
          profileImage: true,
          location: true,
          title: true,
          phone: true,
          studio: true,
          specialties: true,
          website: true,
          instagram: true,
          linkedin: true,
          companyName: true,
          budgetRange: true,
          desiredRooms: true,
          serviceLevel: true,
          projectStatus: true,
          role: true,
          accountStatus: true,
          subscriptionTier: true,
          subscriptionExpiresAt: true,
          aestheticProfile: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // Projects with images and tags
      prisma.project.findMany({
        where: { OR: [{ ownerId: userId }, { designerId: userId }] },
        include: {
          images: {
            select: {
              id: true,
              url: true,
              name: true,
              room: true,
              aiTags: true,
              aiColors: true,
              aiClassification: true,
              createdAt: true,
            },
          },
        },
      }),

      // Behavioral tracking signals (limit to recent 1000)
      prisma.contextSignal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),

      // Atelier signals (design fingerprinting)
      prisma.atelierSignal.findMany({
        where: { OR: [{ designerId: userId }, { vendorId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),

      // Orders and purchases
      prisma.order.findMany({
        where: { OR: [{ purchaserUserId: userId }, { attributedDesignerId: userId }] },
        select: {
          id: true,
          status: true,
          retailAmountCents: true,
          creditAppliedCents: true,
          createdAt: true,
        },
      }),

      // Credit account balance
      prisma.creditAccount.findUnique({
        where: { userId },
      }),

      // Event RSVPs
      prisma.eventRSVP.findMany({
        where: { userId },
      }),

      // Organization memberships
      prisma.organizationUser.findMany({
        where: { userId },
        include: {
          organization: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      userId,
      notice: 'This export contains all your personal data stored in Folio as required by GDPR Article 20 (Right to Data Portability).',
      user,
      projects: {
        total: projects.length,
        data: projects,
      },
      behavioralData: {
        contextSignals: {
          total: contextSignals.length,
          note: 'Limited to most recent 1000 signals',
          data: contextSignals,
        },
        atelierSignals: {
          total: atelierSignals.length,
          note: 'Limited to most recent 1000 signals',
          data: atelierSignals,
        },
      },
      commerce: {
        orders,
        creditAccount,
      },
      events: {
        rsvps: eventRSVPs,
      },
      organizations: orgMemberships.map((m) => ({
        role: m.role,
        organization: m.organization,
        joinedAt: m.createdAt,
      })),
    };

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="folio-data-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/export] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to export user data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
