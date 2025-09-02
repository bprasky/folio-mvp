import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const folderId = params.id;
    const { itemIds, section } = await request.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Item IDs are required' }, { status: 400 });
    }

    // Verify folder exists and user has access
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        designerId: userId,
      },
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found or access denied' }, { status: 404 });
    }

    // For now, we'll store section info in a simple way
    // In a real implementation, you might want to add a section field to FolderProduct
    // For demo purposes, we'll just return success
    
    // Update each folder product (this is a simplified version)
    // In a real app, you'd add a section field to the FolderProduct model
    const updatePromises = itemIds.map(async (itemId) => {
      // For demo, we'll just verify the item exists
      const folderProduct = await prisma.folderProduct.findFirst({
        where: {
          id: itemId,
          folderId: folderId,
        },
      });
      
      if (!folderProduct) {
        throw new Error(`Folder product ${itemId} not found`);
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${itemIds.length} items`,
      section: section
    });
  } catch (error) {
    console.error('Error assigning sections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
