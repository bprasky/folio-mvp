import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user's folders with product counts
    const folders = await prisma.folder.findMany({
      where: { designerId: userId },
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform to include product count
    const foldersWithCounts = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      productCount: folder._count.products
    }));

    return NextResponse.json({ 
      folders: foldersWithCounts 
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const userId = session.user.id;

    // Create new folder
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        designerId: userId,
      },
    });

    return NextResponse.json({ 
      folder: {
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        productCount: 0
      }
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
