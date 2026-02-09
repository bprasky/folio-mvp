export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/permissions';
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';

/**
 * POST /api/selections/[selectionId]/save-to-project
 * Copy a selection from one project to another.
 *
 * Body: { targetProjectId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { selectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { selectionId } = params;

    // Parse body
    const body = await request.json().catch(() => ({}));
    const { targetProjectId } = body;

    if (!targetProjectId) {
      return NextResponse.json({ error: 'targetProjectId is required' }, { status: 400 });
    }

    // Fetch the source selection with its project
    const sourceSelection = await prisma.selection.findUnique({
      where: { id: selectionId },
      include: {
        project: {
          select: { id: true, ownerId: true, designerId: true }
        }
      }
    });

    if (!sourceSelection) {
      return NextResponse.json({ error: 'Selection not found' }, { status: 404 });
    }

    // Verify access to source project
    const sourceAccess = await assertProjectAccess({
      projectId: sourceSelection.projectId,
      userId,
      role: session.user.role
    });
    if (!sourceAccess.ok) {
      return NextResponse.json({ error: 'No access to source project' }, { status: 403 });
    }

    // Verify access to target project
    const targetAccess = await assertProjectAccess({
      projectId: targetProjectId,
      userId,
      role: session.user.role
    });
    if (!targetAccess.ok) {
      return NextResponse.json({ error: 'No access to target project' }, { status: 403 });
    }

    // Don't allow saving to the same project
    if (sourceSelection.projectId === targetProjectId) {
      return NextResponse.json({ error: 'Cannot save to the same project' }, { status: 400 });
    }

    // Find or create "Unsorted" room in target project
    let targetRoomId: string | null = null;
    try {
      const existingRoom = await prisma.room.findFirst({
        where: { projectId: targetProjectId, name: 'Unsorted' },
        select: { id: true },
      });

      if (existingRoom) {
        targetRoomId = existingRoom.id;
      } else {
        const newRoom = await prisma.room.create({
          data: { name: 'Unsorted', projectId: targetProjectId },
          select: { id: true },
        });
        targetRoomId = newRoom.id;
      }
    } catch (e) {
      console.warn('[save-to-project] Could not create Unsorted room:', e);
    }

    // Ensure a Product record exists for the attribution chain
    const linkedProductId = await ensureProductForSelection({
      productName: sourceSelection.productName,
      vendorName: sourceSelection.vendorName,
      photo: sourceSelection.photo,
      unitPrice: sourceSelection.unitPrice ? Number(sourceSelection.unitPrice) : null,
      productUrl: sourceSelection.productUrl,
    });

    // Copy the selection to target project
    // Exclude: id, projectId, roomId, createdAt, updatedAt, productTagId (unique constraint)
    const newSelection = await prisma.selection.create({
      data: {
        projectId: targetProjectId,
        roomId: targetRoomId,
        // Copy all the product data
        photo: sourceSelection.photo,
        vendorName: sourceSelection.vendorName,
        productName: sourceSelection.productName,
        colorFinish: sourceSelection.colorFinish,
        notes: sourceSelection.notes,
        phaseOfUse: sourceSelection.phaseOfUse,
        gpsLocation: sourceSelection.gpsLocation,
        source: 'copy', // Mark as copied
        quantity: sourceSelection.quantity,
        specSheetFileName: sourceSelection.specSheetFileName,
        specSheetUrl: sourceSelection.specSheetUrl,
        unitPrice: sourceSelection.unitPrice,
        vendorProductId: sourceSelection.vendorProductId,
        vendorRepId: sourceSelection.vendorRepId,
        productUrl: sourceSelection.productUrl,
        tags: sourceSelection.tags,
        ...(linkedProductId ? { uiMeta: { productId: linkedProductId } } : {}),
      },
      select: {
        id: true,
        productName: true,
        photo: true,
      }
    });

    return NextResponse.json({
      ok: true,
      selection: newSelection,
      targetProjectId,
    });
  } catch (error: any) {
    console.error('[save-to-project] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save selection to project' },
      { status: 500 }
    );
  }
}
