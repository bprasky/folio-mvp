export const dynamic = 'force-dynamic';

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
    // assertSelectionView checks permissions but only returns minimal fields
    await assertSelectionView(session.user.id, params.selectionId);

    // Fetch full selection data after authorization passes
    const selection = await prisma.selection.findUnique({
      where: { id: params.selectionId },
    });

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

            // Ensure a Product record exists when productName is provided
            let linkedProductId: string | null = null;
            const nameToLink = productName ?? selection.productName;
            if (nameToLink) {
              const existing = await prisma.product.findFirst({
                where: { name: { equals: nameToLink, mode: 'insensitive' } },
                select: { id: true },
              });
              if (existing) {
                linkedProductId = existing.id;
              } else {
                const product = await prisma.product.create({
                  data: {
                    name: nameToLink,
                    brand: (vendorName ?? selection.vendorName) || null,
                    imageUrl: (photo ?? selection.photo) || null,
                    price: unitPrice != null ? Number(unitPrice) : (selection.unitPrice ? Number(selection.unitPrice) : null),
                    url: (productUrl ?? selection.productUrl) || null,
                  },
                  select: { id: true },
                });
                linkedProductId = product.id;
                console.log(`[selections/PATCH] Created Product "${nameToLink}" (${product.id})`);
              }
            }

            // Merge productId into uiMeta
            const existingUiMeta = (selection.uiMeta as Record<string, unknown>) || {};
            const mergedUiMeta = uiMeta !== undefined
              ? { ...uiMeta, ...(linkedProductId ? { productId: linkedProductId } : {}) }
              : (linkedProductId ? { ...existingUiMeta, productId: linkedProductId } : undefined);

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
                ...(mergedUiMeta !== undefined && { uiMeta: mergedUiMeta })
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
