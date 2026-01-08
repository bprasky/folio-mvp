export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

/**
 * POST /api/events/[id]/invites/upload
 * Upload CSV or email list for invites
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const emails = formData.get('emails') as string; // Comma-separated emails
    const source = formData.get('source') as string || 'csv';

    if (!file && !emails) {
      return NextResponse.json(
        { error: 'Either file or emails is required' },
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

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let contacts: Array<{
      email: string;
      name?: string;
      phone?: string;
      company?: string;
      title?: string;
      role?: string;
    }> = [];

    // Parse CSV file
    if (file) {
      const text = await file.text();
      try {
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });

        contacts = result.data.map((record: any) => ({
          email: record.email || record.Email || record.EMAIL,
          name: record.name || record.Name || record.NAME,
          phone: record.phone || record.Phone || record.PHONE,
          company: record.company || record.Company || record.COMPANY,
          title: record.title || record.Title || record.TITLE,
          role: record.role || record.Role || record.ROLE,
        })).filter((c: any) => c.email);
      } catch (error: any) {
        return NextResponse.json(
          { error: `CSV parsing error: ${error.message}` },
          { status: 400 }
        );
      }
    }

    // Parse email list
    if (emails) {
      const emailList = emails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes('@'));

      contacts = [
        ...contacts,
        ...emailList.map((email) => ({ email })),
      ];
    }

    // Deduplicate by email
    const uniqueContacts = Array.from(
      new Map(contacts.map((c) => [c.email.toLowerCase(), c])).values()
    );

    if (uniqueContacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found' },
        { status: 400 }
      );
    }

    // Create contacts
    const createdContacts: any[] = [];
    const errors: any[] = [];

    for (const contact of uniqueContacts) {
      try {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: contact.email.toLowerCase() },
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
          // Update existing
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
              source: source,
            },
          });
          createdContacts.push(updated);
        } else {
          // Create new
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
              source: source,
            },
          });
          createdContacts.push(created);
        }

        // Create relationship edge if user exists
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

    // Update host profile stats
    await prisma.eventHostProfile.update({
      where: { id: hostProfile.id },
      data: {
        totalInvitesSent: { increment: createdContacts.length },
      },
    });

    return NextResponse.json({
      success: true,
      uploaded: uniqueContacts.length,
      created: createdContacts.length,
      contacts: createdContacts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error uploading invites:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

