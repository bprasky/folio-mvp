import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { normalizeRole } from '@/lib/permissions';

/**
 * GET /api/individual/match-designers
 * Returns designer matches for an Individual based on their saved items
 * For demo: returns designers with basic matching logic
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = normalizeRole(session.user.role);
    if (userRole !== 'INDIVIDUAL') {
      return NextResponse.json(
        { error: 'Only Individuals can match designers' },
        { status: 403 }
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Demo mode: if demo@folio.com, return a hardcoded top designer match
    const isDemoMode = process.env.FOLIO_DEMO_MODE === 'true' || userEmail === 'demo@folio.com';

    if (isDemoMode) {
      // Find a designer to use as the demo match
      // Try to find designer@folio.com or any designer
      const demoDesigner = await prisma.user.findFirst({
        where: {
          role: 'DESIGNER',
        },
        select: {
          id: true,
          name: true,
          email: true,
          location: true,
          profileImage: true,
          specialties: true,
        },
        take: 1,
      });

      if (demoDesigner) {
        return NextResponse.json({
          matches: [
            {
              designerId: demoDesigner.id,
              name: demoDesigner.name || 'Demo Designer',
              location: demoDesigner.location || 'San Francisco, CA',
              avatarUrl: demoDesigner.profileImage || '/images/placeholder-avatar.jpg',
              offerings: ['Full-service design', 'Remote design'],
              styleTags: ['modern', 'warm_neutrals', 'minimal'],
              projectRange: {
                minBudget: 50000,
                maxBudget: 250000,
                typicalScope: 'Whole-home and multi-room projects',
              },
              matchScores: {
                styleOverlap: 0.92,
                projectTierFit: 0.88,
                vendorOverlap: 0.75,
                locationFit: 1.0,
                overallMatch: 0.89,
              },
              reasonChips: [
                'Frequently uses materials you\'ve saved',
                'Experienced with luxury projects your size',
                'Located nearby • Offers in-person and remote',
              ],
              previewProjects: [],
              cta: {
                primary: {
                  label: 'Hire This Designer',
                  action: '#',
                },
                secondary: {
                  label: 'View Portfolio',
                  action: `/designer/${demoDesigner.id}`,
                },
              },
            },
          ],
        });
      }
    }

    // Production mode: query designers with basic matching
    // For now, return top designers (can be enhanced with actual matching logic)
    const designers = await prisma.user.findMany({
      where: {
        role: 'DESIGNER',
      },
      select: {
        id: true,
        name: true,
        email: true,
        location: true,
        profileImage: true,
        specialties: true,
      },
      take: 5,
    });

    const matches = designers.map((designer, index) => ({
      designerId: designer.id,
      name: designer.name || 'Designer',
      location: designer.location || 'Location TBD',
      avatarUrl: designer.profileImage || '/images/placeholder-avatar.jpg',
      offerings: ['Full-service design', 'Remote design'],
      styleTags: designer.specialties || ['modern', 'contemporary'],
      projectRange: {
        minBudget: 30000 + index * 10000,
        maxBudget: 150000 + index * 50000,
        typicalScope: 'Whole-home and multi-room projects',
      },
      matchScores: {
        styleOverlap: 0.7 + index * 0.05,
        projectTierFit: 0.75 + index * 0.03,
        vendorOverlap: 0.5 + index * 0.05,
        locationFit: 0.8,
        overallMatch: 0.7 + index * 0.04,
      },
      reasonChips: [
        'Experienced with projects your size',
        'Strong portfolio in your style',
      ],
      previewProjects: [],
      cta: {
        primary: {
          label: 'Hire This Designer',
          action: '#',
        },
        secondary: {
          label: 'View Portfolio',
          action: `/designer/${designer.id}`,
        },
      },
    }));

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error('[match-designers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to match designers', details: error.message },
      { status: 500 }
    );
  }
}




