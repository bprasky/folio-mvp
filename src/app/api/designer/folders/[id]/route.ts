import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
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

    // Fetch folder with product count
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        designerId: userId,
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ 
      folder: {
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        productCount: folder._count.products
      }
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    // Delete folder and all associated products (cascade)
    await prisma.folder.delete({
      where: { id: folderId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
