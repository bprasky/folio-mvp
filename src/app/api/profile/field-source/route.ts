export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';
import type { ProfileFieldSourceType } from '@prisma/client';

/**
 * GET /api/profile/field-source?orgId=xxx or ?userId=xxx
 * Returns all ProfileFieldSource records for the given entity.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const userId = searchParams.get('userId');

    if (!orgId && !userId) {
      return NextResponse.json({ error: 'orgId or userId required' }, { status: 400 });
    }

    const sources = await prisma.profileFieldSource.findMany({
      where: orgId ? { organizationId: orgId } : { userId: userId! },
    });

    // Return as a map: { fieldName: source }
    const sourceMap: Record<string, { source: string; extractedAt: string | null; manuallyEditedAt: string | null }> = {};
    for (const s of sources) {
      sourceMap[s.fieldName] = {
        source: s.source,
        extractedAt: s.extractedAt?.toISOString() ?? null,
        manuallyEditedAt: s.manuallyEditedAt?.toISOString() ?? null,
      };
    }

    return NextResponse.json({ sources: sourceMap });
  } catch (error) {
    console.error('[GET /api/profile/field-source] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch field sources' }, { status: 500 });
  }
}

/**
 * PATCH /api/profile/field-source
 * Updates a field's source type when a user manually edits an extracted field.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, userId, fieldName, source } = await request.json();

    if (!fieldName || !source) {
      return NextResponse.json({ error: 'fieldName and source required' }, { status: 400 });
    }

    // Auth check for org fields
    if (organizationId) {
      const memberships = await getUserOrgMemberships(session.user.id);
      if (!isOrgAdmin(memberships, organizationId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Auth check for user fields — must be own profile
    if (userId && userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();

    if (organizationId) {
      await prisma.profileFieldSource.upsert({
        where: {
          organizationId_fieldName: {
            organizationId,
            fieldName,
          },
        },
        create: {
          organizationId,
          fieldName,
          source: source as ProfileFieldSourceType,
          manuallyEditedAt: source === 'INTERVIEW_THEN_EDITED' ? now : null,
        },
        update: {
          source: source as ProfileFieldSourceType,
          manuallyEditedAt: source === 'INTERVIEW_THEN_EDITED' ? now : null,
        },
      });
    } else {
      const targetUserId = userId || session.user.id;
      await prisma.profileFieldSource.upsert({
        where: {
          userId_fieldName: {
            userId: targetUserId,
            fieldName,
          },
        },
        create: {
          userId: targetUserId,
          fieldName,
          source: source as ProfileFieldSourceType,
          manuallyEditedAt: source === 'INTERVIEW_THEN_EDITED' ? now : null,
        },
        update: {
          source: source as ProfileFieldSourceType,
          manuallyEditedAt: source === 'INTERVIEW_THEN_EDITED' ? now : null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/profile/field-source] Error:', error);
    return NextResponse.json({ error: 'Failed to update field source' }, { status: 500 });
  }
}
