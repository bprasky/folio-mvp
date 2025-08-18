import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    
    if (!idsParam) {
      return NextResponse.json([]);
    }

    const ids = idsParam.split(',').filter(Boolean);
    
    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    // Try to fetch products if the model exists
    try {
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: ids,
          },
        },
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
      });

      const results = products.map(product => ({
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        vendorName: product.vendor?.companyName || product.vendor?.name || null,
      }));

      return NextResponse.json(results);
    } catch (error) {
      // Product model doesn't exist or other error
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('Bulk products fetch error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
} 