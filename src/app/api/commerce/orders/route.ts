import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { createOrder, getUserOrders } from '@/lib/commerce/orders';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be positive'),
        retailPriceCents: z
          .number()
          .int()
          .positive('Retail price must be positive'),
        productTagId: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required'),
  attributedDesignerId: z.string().optional(),
  attributedRepId: z.string().optional(),
  creditToApplyCents: z.number().int().min(0).optional(),
  fulfillmentMethod: z.enum([
    'TRADE_LOGIN',
    'QUOTE',
    'REP_MEDIATED',
    'API',
    'MANUAL',
  ]),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const cursor = searchParams.get('cursor') || undefined;
  const status = searchParams.get('status') || undefined;

  try {
    const result = await getUserOrders(session.user.id, {
      limit: Math.min(limit, 100),
      cursor,
      status: status as any,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = createOrderSchema.parse(body);

    const order = await createOrder({
      ...validated,
      purchaserUserId: session.user.id,
    });

    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Order creation error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
