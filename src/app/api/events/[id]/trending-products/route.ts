import { NextRequest, NextResponse } from 'next/server';
import { getTrendingProductsForEvent } from '@/lib/events';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const products = await getTrendingProductsForEvent(eventId);

    return NextResponse.json({
      products: products,
    });
  } catch (error) {
    console.error('Error fetching trending products:', error);
    return NextResponse.json(
      { products: [] },
      { status: 500 }
    );
  }
}
