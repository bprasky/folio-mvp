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
    const { type, title, source, date, url, imageUrl, excerpt, sourceLogoUrl } = body;

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Type and title are required' },
        { status: 400 }
      );
    }

    // Create recognition entry (auto-set publishedAt so it appears in feed)
    const recognition = await prisma.orgRecognition.create({
      data: {
        organizationId: orgId,
        type,
        title,
        source: source || '',
        date: date ? new Date(date) : new Date(),
        url: url || null,
        imageUrl: imageUrl || null,
        excerpt: excerpt || null,
        sourceLogoUrl: sourceLogoUrl || null,
        publishedAt: new Date(),
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
