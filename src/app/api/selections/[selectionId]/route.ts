import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertSelectionView } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { selectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { access, selection } = await assertSelectionView(session.user.id, params.selectionId);

    if (!selection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(selection);
  } catch (error) {
    console.error('Error fetching selection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selection' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { selectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { access, selection } = await assertSelectionView(session.user.id, params.selectionId);
    
    const body = await request.json();
            const { 
              productName, 
              vendorName, 
              productUrl, 
              photo, 
              notes, 
              unitPrice, 
              vendorProductId,
              slotKey,
              uiMeta
            } = body;

            // Update the selection
            const updatedSelection = await prisma.selection.update({
              where: { id: params.selectionId },
              data: {
                ...(productName !== undefined && { productName }),
                ...(vendorName !== undefined && { vendorName }),
                ...(productUrl !== undefined && { productUrl }),
                ...(photo !== undefined && { photo }),
                ...(notes !== undefined && { notes }),
                ...(unitPrice !== undefined && { unitPrice }),
                ...(vendorProductId !== undefined && { vendorProductId }),
                ...(slotKey !== undefined && { slotKey }),
                ...(uiMeta !== undefined && { uiMeta })
              }
            });

            console.log('Selection updated successfully:', {
              id: updatedSelection.id,
              productName: updatedSelection.productName,
              vendorName: updatedSelection.vendorName,
              unitPrice: updatedSelection.unitPrice
            });

    return NextResponse.json({
      success: true,
      selection: updatedSelection
    });
  } catch (error) {
    console.error('Error updating selection:', error);
    return NextResponse.json(
      { error: 'Failed to update selection' },
      { status: 500 }
    );
  }
}
