import { NextRequest, NextResponse } from 'next/server';
import { getFeaturedProductsForEvent } from '@/lib/events';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const products = await getFeaturedProductsForEvent(eventId);

    return NextResponse.json({
      products: products,
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return NextResponse.json(
      { products: [] },
      { status: 500 }
    );
  }
}
