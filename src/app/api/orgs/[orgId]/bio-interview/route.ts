export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';

/**
 * POST /api/orgs/[orgId]/bio-interview - Save bio interview answers
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

    const { answers } = await request.json();

    // Extract layer2Responses from nested answers
    const layer2Responses: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers)) {
      if (key.startsWith('layer2Responses.')) {
        const fieldName = key.replace('layer2Responses.', '');
        layer2Responses[fieldName] = value as string;
      }
    }

    // Upsert bio interview
    const interview = await prisma.orgBioInterview.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        originStory: answers.originStory,
        philosophyStatement: answers.philosophyStatement,
        projectTypes: answers.projectTypes || [],
        location: answers.location,
        serviceRegions: answers.serviceRegions || [],
        idealClient: answers.idealClient,
        layer2Responses: Object.keys(layer2Responses).length > 0 ? layer2Responses : null,
        recognitionMentions: answers.recognitionMentions,
        collaboratorMentions: answers.collaboratorMentions,
        representativeProjectId: answers.representativeProjectId
      },
      update: {
        originStory: answers.originStory,
        philosophyStatement: answers.philosophyStatement,
        projectTypes: answers.projectTypes || [],
        location: answers.location,
        serviceRegions: answers.serviceRegions || [],
        idealClient: answers.idealClient,
        layer2Responses: Object.keys(layer2Responses).length > 0 ? layer2Responses : null,
        recognitionMentions: answers.recognitionMentions,
        collaboratorMentions: answers.collaboratorMentions,
        representativeProjectId: answers.representativeProjectId
      }
    });

    return NextResponse.json({ success: true, interview });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/bio-interview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save bio interview' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orgs/[orgId]/bio-interview - Get bio interview data
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

    const interview = await prisma.orgBioInterview.findUnique({
      where: { organizationId: orgId }
    });

    if (!interview) {
      return NextResponse.json({ interview: null });
    }

    return NextResponse.json({ interview });
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]/bio-interview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bio interview' },
      { status: 500 }
    );
  }
}
