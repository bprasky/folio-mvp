import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    if (process.env.NODE_ENV !== 'production') {
      console.info('[product search]', { q: query, limit });
    }

    // Try to search products if the model exists
    try {
      const products = await prisma.product.findMany({
        where: {
          name: {
            contains: query,
            mode: 'insensitive' as any,
          },
        },
        take: limit,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          vendor: {
            select: {
              id: true,
              name: true,
              companyName: true,
            }
          }
        },
        orderBy: {
          name: 'asc',
        },
      });

      const results = products.map(product => ({
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        vendorName: product.vendor?.companyName || product.vendor?.name || null,
      }));

      if (process.env.NODE_ENV !== 'production') {
        console.info('[product search] results:', results.length);
      }

      return NextResponse.json(results);
    } catch (error) {
      // Product model doesn't exist or other error
      if (process.env.NODE_ENV !== 'production') {
        console.info('[product search] Product model not available, returning empty results');
      }
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
} 