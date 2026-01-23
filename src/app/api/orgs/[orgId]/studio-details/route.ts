export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * PATCH /api/orgs/[orgId]/studio-details - Update studio details
 */
export async function PATCH(
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

    const body = await request.json();
    const {
      foundedYear,
      teamSizeRange,
      services,
      projectTypes,
      serviceRegions,
      memberships: orgMemberships,
      certifications
    } = body;

    // Update organization
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        foundedYear: foundedYear || null,
        teamSizeRange: teamSizeRange || null,
        services: services || [],
        projectTypes: projectTypes || [],
        serviceRegions: serviceRegions || [],
        memberships: orgMemberships || [],
        certifications: certifications || []
      }
    });

    // Update onboarding progress
    const hasDetails =
      foundedYear ||
      teamSizeRange ||
      (services && services.length > 0) ||
      (projectTypes && projectTypes.length > 0);

    if (hasDetails) {
      await prisma.orgOnboardingProgress.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          studioDetailsComplete: true
        },
        update: {
          studioDetailsComplete: true
        }
      });
    }

    return NextResponse.json({ success: true, org });
  } catch (error) {
    console.error('[PATCH /api/orgs/[orgId]/studio-details] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update studio details' },
      { status: 500 }
    );
  }
}
