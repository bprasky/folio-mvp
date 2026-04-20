// @idor-allow: IDOR003 reason="Handlers self-scope by session.user.id to the caller's own hostProfile; event id in URL is unused for auth"
// @idor-allow: IDOR004 reason="Mutations operate only on invite lists owned by the caller's hostProfile"
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/invites/lists
 * Get all saved invite lists for the host
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hostProfile = await prisma.eventHostProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        inviteLists: {
          orderBy: { lastUsedAt: 'desc' },
        },
      },
    });

    if (!hostProfile) {
      return NextResponse.json({ error: 'Host profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      lists: hostProfile.inviteLists,
    });
  } catch (error: any) {
    console.error('Error fetching invite lists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[id]/invites/lists
 * Create a new saved invite list
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
    const { name, description, listType, contactIds, targetingCriteria, isPremium, priceUsd } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      );
    }

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

    // Create invite list
    const inviteList = await prisma.eventInviteList.create({
      data: {
        hostProfileId: hostProfile.id,
        name,
        description,
        listType: listType || 'manual',
        contactIds: contactIds || [],
        targetingCriteria: targetingCriteria || null,
        isPremium: isPremium || false,
        priceUsd: priceUsd || null,
      },
    });

    return NextResponse.json({
      success: true,
      list: inviteList,
    });
  } catch (error: any) {
    console.error('Error creating invite list:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/[id]/invites/lists/[listId]
 * Update a saved invite list
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; listId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, contactIds, targetingCriteria } = body;

    // Verify ownership
    const hostProfile = await prisma.eventHostProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!hostProfile) {
      return NextResponse.json({ error: 'Host profile not found' }, { status: 404 });
    }

    const inviteList = await prisma.eventInviteList.findFirst({
      where: {
        id: params.listId,
        hostProfileId: hostProfile.id,
      },
    });

    if (!inviteList) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Update list
    const updated = await prisma.eventInviteList.update({
      where: { id: params.listId },
      data: {
        name: name || inviteList.name,
        description: description !== undefined ? description : inviteList.description,
        contactIds: contactIds || inviteList.contactIds,
        targetingCriteria: targetingCriteria !== undefined ? targetingCriteria : inviteList.targetingCriteria,
      },
    });

    return NextResponse.json({
      success: true,
      list: updated,
    });
  } catch (error: any) {
    console.error('Error updating invite list:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}




