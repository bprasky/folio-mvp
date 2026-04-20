// @idor-allow: public-read reason="Dev-only debug helper; 404s in production via NODE_ENV check"
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Debug route to find products by name and vendor
 * Usage: /api/dev/find-product?name=Terra&vendor=Rove
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';
    const vendor = searchParams.get('vendor') || '';

    // Find vendor
    const vendorUser = vendor ? await prisma.user.findFirst({
      where: {
        name: { contains: vendor, mode: 'insensitive' },
        role: 'VENDOR',
      },
      select: { id: true, name: true },
    }) : null;

    // Find product
    const where: any = {};
    
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    
    if (vendorUser) {
      where.vendorId = vendorUser.id;
    }

    const products = await prisma.product.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        brand: true,
        imageUrl: true,
        isPending: true,
        createdAt: true,
        vendorId: true,
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      query: { name, vendor },
      vendorFound: vendorUser,
      productsFound: products.length,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        status: p.isPending ? 'DRAFT' : 'PUBLISHED',
        imageUrl: p.imageUrl,
        vendor: p.vendor?.name,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Debug route error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}




