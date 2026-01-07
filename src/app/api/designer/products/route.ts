import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, sku, url, vendorName, priceCents, imageUrl } = await req.json();

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  // Create or reuse a lightweight vendor user for attribution
  const normalizedVendor = (vendorName?.trim() || 'External Vendor').slice(0, 80);
  const vendorEmail = `vendor+${normalizedVendor.toLowerCase().replace(/\s+/g, '-')}${Math.floor(
    Math.random() * 1e6
  )}@folio.local`;

  const vendor = await prisma.user.create({
    data: { email: vendorEmail, name: normalizedVendor, role: 'VENDOR', passwordHash: 'external' },
  });

  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      name,
      url: url ?? null,
      imageUrl: imageUrl ?? null,
      price: priceCents ? priceCents / 100 : null,
      category: 'External',
      brand: normalizedVendor,
    },
  });

  return NextResponse.json({ ok: true, productId: product.id });
}
