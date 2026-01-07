import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const vendorId = searchParams.get('vendorId');

    // Build where clause
    const where: any = { isPending: false }; // Only published products
    
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Role-based filtering
    if (session.user.role?.toLowerCase() === 'vendor') {
      where.vendorId = session.user.id;
    } else if (vendorId) {
      where.vendorId = vendorId;
    }

    const items = await prisma.product.findMany({
      where,
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        brand: true,
        url: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Map to expected format
    const results = items.map(item => ({
      id: item.id,
      name: item.name,
      slug: item.id, // Using id as slug
      sku: item.brand || '—',
      thumbnailUrl: item.imageUrl,
      vendor: item.vendor,
    }));

    return NextResponse.json({ items: results });
  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json(
      { error: 'Failed to search products' },
      { status: 500 }
    );
  }
}




