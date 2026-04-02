export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/contacts/[id]
 *
 * Update a contact (toggle preferred rep, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;
    const body = await request.json();

    // Verify ownership
    const contact = await prisma.designerContact.findUnique({
      where: { id },
    });

    if (!contact || contact.userId !== session.user.id) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof body.isPreferredRep === 'boolean') {
      updateData.isPreferredRep = body.isPreferredRep;

      // If setting as preferred, unset any other preferred rep for the same vendor
      if (body.isPreferredRep && contact.vendorOrgId) {
        await prisma.designerContact.updateMany({
          where: {
            userId: session.user.id,
            vendorOrgId: contact.vendorOrgId,
            id: { not: id },
            isPreferredRep: true,
          },
          data: { isPreferredRep: false },
        });
      }
    }

    const updated = await prisma.designerContact.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ contact: updated });
  } catch (error) {
    console.error('[API] /api/contacts/[id] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

/**
 * DELETE /api/contacts/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const contact = await prisma.designerContact.findUnique({
      where: { id },
    });

    if (!contact || contact.userId !== session.user.id) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await prisma.designerContact.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[API] /api/contacts/[id] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
