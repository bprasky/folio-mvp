export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/contacts
 *
 * List designer's imported contacts, grouped by vendor.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contacts = await prisma.designerContact.findMany({
      where: { userId: session.user.id },
      orderBy: [
        { matchConfidence: 'asc' }, // HIGH first (enum order)
        { vendorName: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group by vendor
    const vendorGroups: Record<string, {
      vendorName: string;
      vendorOrgId: string | null;
      contacts: typeof contacts;
    }> = {};

    const unmatched: typeof contacts = [];

    for (const contact of contacts) {
      if (contact.vendorName) {
        const key = contact.vendorName.toLowerCase();
        if (!vendorGroups[key]) {
          vendorGroups[key] = {
            vendorName: contact.vendorName,
            vendorOrgId: contact.vendorOrgId,
            contacts: [],
          };
        }
        vendorGroups[key].contacts.push(contact);
      } else {
        unmatched.push(contact);
      }
    }

    // Sort groups: HIGH confidence first, then MEDIUM, then LOW
    const sorted = Object.values(vendorGroups).sort((a, b) => {
      const confOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, UNMATCHED: 3 };
      const aConf = a.contacts[0]?.matchConfidence || 'UNMATCHED';
      const bConf = b.contacts[0]?.matchConfidence || 'UNMATCHED';
      return (confOrder[aConf] || 3) - (confOrder[bConf] || 3);
    });

    return NextResponse.json({
      vendorGroups: sorted,
      unmatched,
      total: contacts.length,
    });
  } catch (error) {
    console.error('[API] /api/contacts error:', error);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

/**
 * POST /api/contacts
 *
 * Confirm import — set preferred reps for selected contacts.
 * Body: { contactIds: string[], preferredRepIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { preferredRepIds } = await request.json();

    if (Array.isArray(preferredRepIds) && preferredRepIds.length > 0) {
      // Set these contacts as preferred reps
      await prisma.designerContact.updateMany({
        where: {
          id: { in: preferredRepIds },
          userId: session.user.id,
        },
        data: { isPreferredRep: true },
      });

      // Mark the import job as completed
      const firstContact = await prisma.designerContact.findFirst({
        where: { id: preferredRepIds[0], userId: session.user.id },
        select: { importSourceId: true },
      });
      if (firstContact) {
        await prisma.contactImportJob.update({
          where: { id: firstContact.importSourceId },
          data: { status: 'COMPLETED' },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] /api/contacts POST error:', error);
    return NextResponse.json({ error: 'Failed to confirm contacts' }, { status: 500 });
  }
}
