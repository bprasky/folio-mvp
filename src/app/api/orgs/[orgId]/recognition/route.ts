export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * GET /api/orgs/[orgId]/recognition - Get recognition entries
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    const recognition = await prisma.orgRecognition.findMany({
      where: { organizationId: orgId },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json({ recognition });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/recognition] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recognition' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orgs/[orgId]/recognition - Add recognition entry
 */
export async function POST(
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
    const { type, title, source, date, url } = body;

    if (!type || !title || !source) {
      return NextResponse.json(
        { error: 'Type, title, and source are required' },
        { status: 400 }
      );
    }

    // Create recognition entry
    const recognition = await prisma.orgRecognition.create({
      data: {
        organizationId: orgId,
        type,
        title,
        source,
        date: date ? new Date(date) : new Date(),
        url: url || null
      }
    });

    // Update onboarding progress
    await prisma.orgOnboardingProgress.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        recognitionComplete: true
      },
      update: {
        recognitionComplete: true
      }
    });

    return NextResponse.json({ success: true, recognition });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/recognition] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add recognition' },
      { status: 500 }
    );
  }
}
