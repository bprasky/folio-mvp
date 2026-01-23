export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * GET /api/orgs/[orgId]/process-phases - Get process phases
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    const phases = await prisma.orgProcessPhase.findMany({
      where: { organizationId: orgId },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ phases });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/process-phases] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch process phases' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orgs/[orgId]/process-phases - Replace all process phases
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Verify user is org owner/admin
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { phases } = await request.json();

    if (!Array.isArray(phases)) {
      return NextResponse.json(
        { error: 'Phases must be an array' },
        { status: 400 }
      );
    }

    // Delete existing phases and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing
      await tx.orgProcessPhase.deleteMany({
        where: { organizationId: orgId }
      });

      // Create new phases
      if (phases.length > 0) {
        await tx.orgProcessPhase.createMany({
          data: phases.map((phase: { name: string; description?: string; order: number }, index: number) => ({
            organizationId: orgId,
            name: phase.name,
            description: phase.description || null,
            order: phase.order ?? index
          }))
        });
      }

      // Update onboarding progress
      await tx.orgOnboardingProgress.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          processComplete: phases.length > 0
        },
        update: {
          processComplete: phases.length > 0
        }
      });
    });

    const updatedPhases = await prisma.orgProcessPhase.findMany({
      where: { organizationId: orgId },
      orderBy: { order: 'asc' }
    });

    return NextResponse.json({ success: true, phases: updatedPhases });
  } catch (error) {
    console.error('[PUT /api/orgs/[orgId]/process-phases] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save process phases' },
      { status: 500 }
    );
  }
}
