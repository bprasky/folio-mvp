import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/[id]/invites
 * Get all invites for an event
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

    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: {
        hostProfile: {
          include: {
            contacts: {
              where: {
                sourceEventId: params.id,
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    profileImage: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if user is the host or admin
    if (event.hostProfile?.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      eventId: params.id,
      invites: event.hostProfile?.contacts || [],
      totalInvites: event.hostProfile?.contacts.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[id]/invites
 * Create invites for an event
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
    const { contacts, inviteListId, targetingProfileId } = body;

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

    // Verify event exists and user has permission
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Update event host profile if not set
    if (!event.hostProfileId) {
      await prisma.event.update({
        where: { id: params.id },
        data: { hostProfileId: hostProfile.id },
      });
    }

    const createdContacts: any[] = [];
    const errors: any[] = [];

    // Process contacts array
    if (contacts && Array.isArray(contacts)) {
      for (const contact of contacts) {
        try {
          // Check if user exists by email
          const existingUser = await prisma.user.findUnique({
            where: { email: contact.email },
          });

          // Check if contact already exists
          const existingContact = await prisma.eventContact.findUnique({
            where: {
              hostProfileId_email: {
                hostProfileId: hostProfile.id,
                email: contact.email.toLowerCase(),
              },
            },
          });

          if (existingContact) {
            // Update existing contact
            const updated = await prisma.eventContact.update({
              where: { id: existingContact.id },
              data: {
                name: contact.name || existingContact.name,
                phone: contact.phone || existingContact.phone,
                company: contact.company || existingContact.company,
                title: contact.title || existingContact.title,
                role: contact.role || existingContact.role,
                userId: existingUser?.id || existingContact.userId,
                totalInvitesReceived: { increment: 1 },
                lastInvitedAt: new Date(),
                sourceEventId: params.id,
                source: contact.source || 'manual',
              },
            });
            createdContacts.push(updated);
          } else {
            // Create new contact
            const created = await prisma.eventContact.create({
              data: {
                hostProfileId: hostProfile.id,
                email: contact.email.toLowerCase(),
                name: contact.name,
                phone: contact.phone,
                company: contact.company,
                title: contact.title,
                role: contact.role,
                userId: existingUser?.id,
                totalInvitesReceived: 1,
                lastInvitedAt: new Date(),
                sourceEventId: params.id,
                source: contact.source || 'manual',
                tags: contact.tags || [],
              },
            });
            createdContacts.push(created);
          }

          // Create relationship edge
          if (existingUser) {
            const existingEdge = await prisma.eventRelationshipEdge.findFirst({
              where: {
                hostProfileId: hostProfile.id,
                sourceType: 'host',
                sourceId: hostProfile.id,
                targetType: 'designer',
                targetId: existingUser.id,
                eventId: params.id,
                relationshipType: 'invited',
              },
            });

            if (existingEdge) {
              await prisma.eventRelationshipEdge.update({
                where: { id: existingEdge.id },
                data: {
                  weight: { increment: 1.0 },
                  updatedAt: new Date(),
                },
              });
            } else {
              await prisma.eventRelationshipEdge.create({
                data: {
                  hostProfileId: hostProfile.id,
                  sourceType: 'host',
                  sourceId: hostProfile.id,
                  targetType: 'designer',
                  targetId: existingUser.id,
                  relationshipType: 'invited',
                  eventId: params.id,
                  weight: 1.0,
                },
              });
            }
          }
        } catch (error: any) {
          errors.push({
            email: contact.email,
            error: error.message,
          });
        }
      }
    }

    // Update host profile stats
    await prisma.eventHostProfile.update({
      where: { id: hostProfile.id },
      data: {
        totalInvitesSent: { increment: createdContacts.length },
      },
    });

    return NextResponse.json({
      success: true,
      created: createdContacts.length,
      contacts: createdContacts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error creating invites:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

