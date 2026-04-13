export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/orgs/[orgId]/onboarding-progress - Get onboarding progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    const membership = await prisma.organizationUser.findFirst({
      where: { userId: session.user.id, organizationId: orgId, isActive: true },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get or create progress record
    let progress = await prisma.orgOnboardingProgress.findUnique({
      where: { organizationId: orgId }
    });

    if (!progress) {
      progress = await prisma.orgOnboardingProgress.create({
        data: { organizationId: orgId }
      });
    }

    return NextResponse.json({
      progress: {
        bioInterviewComplete: progress.bioInterviewComplete,
        studioDetailsComplete: progress.studioDetailsComplete,
        teamSetupComplete: progress.teamSetupComplete,
        processComplete: progress.processComplete,
        recognitionComplete: progress.recognitionComplete,
        vendorRelationshipsComplete: progress.vendorRelationshipsComplete,
        pinnedWorkComplete: progress.pinnedWorkComplete
      }
    });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/onboarding-progress] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding progress' },
      { status: 500 }
    );
  }
}
