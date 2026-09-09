export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { unclaimedProductAttribution } from '@/lib/products/unclaimedAttribution';
import { z } from 'zod';

const ProductInput = z.object({
  name: z.string().trim().min(1),
  vendorName: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  priceCents: z.number().finite().nonnegative().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = ProductInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid product input' }, { status: 400 });
  const { name, url, vendorName, priceCents, imageUrl } = parsed.data;
  const attribution = unclaimedProductAttribution((vendorName?.trim() || 'External Vendor').slice(0, 80));

  const product = await prisma.product.create({
    data: {
      ...attribution,
      name,
      url: url ?? null,
      imageUrl: imageUrl ?? null,
      price: priceCents != null ? priceCents / 100 : null,
      category: 'External',
    },
  });

  return NextResponse.json({ ok: true, productId: product.id });
}
