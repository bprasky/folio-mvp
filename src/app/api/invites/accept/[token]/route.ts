import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/invites/accept/[token]
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    // Find the invite
    const invite = await prisma.subEventInvite.findUnique({
      where: { inviteToken: params.token },
      include: {
        subEvent: {
          include: {
            event: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invite token' },
        { status: 404 }
      );
    }

    // Check if invite is expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: 'Invite has expired' },
        { status: 410 }
      );
    }

    // Check if invite is already accepted
    if (invite.status === 'accepted') {
      return NextResponse.json(
        { error: 'Invite already accepted' },
        { status: 409 }
      );
    }

    const { name, email, website } = await req.json();

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          profileType: 'designer',
          website: website || null,
        }
      });
    }

    // Update invite status
    await prisma.subEventInvite.update({
      where: { id: invite.id },
      data: {
        status: 'accepted',
        userId: user.id
      }
    });

    // Create RSVP for the sub-event
    await prisma.subEventRSVP.create({
      data: {
        subEventId: invite.subEventId,
        userId: user.id,
        status: 'confirmed'
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profileType: user.profileType
      },
      subEvent: {
        id: invite.subEvent.id,
        title: invite.subEvent.title,
        eventTitle: invite.subEvent.event.title
      }
    });

  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 }
    );
  }
}

// GET /api/invites/accept/[token] - Validate invite token
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const invite = await prisma.subEventInvite.findUnique({
      where: { inviteToken: params.token },
      include: {
        subEvent: {
          include: {
            event: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        invitedByUser: {
          select: {
            name: true
          }
        }
      }
    });

    if (!invite) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite token' },
        { status: 404 }
      );
    }

    // Check if invite is expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json(
        { valid: false, error: 'Invite has expired' },
        { status: 410 }
      );
    }

    // Check if invite is already accepted
    if (invite.status === 'accepted') {
      return NextResponse.json(
        { valid: false, error: 'Invite already accepted' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      valid: true,
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        message: invite.message,
        expiresAt: invite.expiresAt,
        subEvent: {
          id: invite.subEvent.id,
          title: invite.subEvent.title,
          description: invite.subEvent.description,
          startTime: invite.subEvent.startTime,
          endTime: invite.subEvent.endTime,
          location: invite.subEvent.location,
          type: invite.subEvent.type,
          event: invite.subEvent.event
        },
        invitedBy: invite.invitedByUser
      }
    });

  } catch (error) {
    console.error('Error validating invite:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate invite' },
      { status: 500 }
    );
  }
} 