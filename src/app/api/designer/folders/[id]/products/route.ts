import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/options';
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

    // Fetch folder products with product details
    const folderProducts = await prisma.folderProduct.findMany({
      where: { folderId },
      include: {
        product: {
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                companyName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include section (stored in notes for now)
    const products = folderProducts.map(fp => ({
      id: fp.id,
      product: {
        id: fp.product.id,
        name: fp.product.name,
        imageUrl: fp.product.imageUrl,
        price: fp.product.price,
        vendor: fp.product.vendor,
      },
      section: null, // We'll add section support later
      createdAt: fp.createdAt,
    }));

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching folder products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
