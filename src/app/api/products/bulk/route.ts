// @idor-allow: public-read reason="Public bulk product fetch for directory pages"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { resolveProductImage, PRODUCT_PROVENANCE_SELECT } from "@/lib/products/imageProvenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Provenance gate (spec 17): anonymous callers get VENDOR_REFERENCE
    // suppressed; authenticated callers keep the workspace view.
    const session = await getServerSession(authOptions);
    const renderContext = session?.user?.id ? 'INTERNAL' : 'PUBLIC';

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
          ...PRODUCT_PROVENANCE_SELECT,
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
        imageUrl: resolveProductImage(product, null, renderContext),
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