export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt"; // robust auth fallback
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';

export async function POST(req: Request, { params }: { params: { id: string }}) {
  const body = await req.json().catch(() => ({}));
  // derive userId for vendorRepId attribution
  let userId: string | null = null;
  try {
    const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    userId = (t?.sub as string) || (t as any)?.id || null;
  } catch {}

  const productName = String(body?.name || body?.title || "Untitled");
  const unitPrice = body?.price != null ? Number(body.price) : null;
  const imageUrl = body?.imageUrl ?? body?.photoUrl ?? null;

  // Ensure a Product record exists for the attribution chain
  const linkedProductId = await ensureProductForSelection({
    productName,
    vendorName: null,
    photo: imageUrl,
    unitPrice,
  });

  const data: any = {
    projectId: params.id as any,
    name: productName,
    sku: body?.sku ?? null,
    quantity: body?.quantity != null ? Number(body.quantity) : 1,
    price: unitPrice,
    imageUrl,
    notes: body?.notes ?? body?.note ?? null,
    ...(linkedProductId ? { uiMeta: { productId: linkedProductId } } : {}),
  };
  // attach room if provided
  if (body?.roomId) data.roomId = String(body.roomId);
  // vendor attribution for visibility
  if (userId) data.vendorRepId = userId;

  // strip nulls (but keep uiMeta)
  Object.keys(data).forEach(k => (k !== 'uiMeta' && data[k] == null) && delete data[k]);

  try {
    const sel = await prisma.selection.create({ data, select: { id: true, productName: true, projectId: true, /* roomId may not exist */ } });
    return NextResponse.json({ selection: sel }, { status: 201 });
  } catch (e) {
    console.warn("[Selection POST] failed, retry without roomId/vendorRepId:", (e as any)?.message);
    // demo fallback: try again without optional fields if schema differs
    delete data.roomId; delete data.vendorRepId;
    try {
      const sel = await prisma.selection.create({ data, select: { id: true, productName: true, projectId: true } });
      return NextResponse.json({ selection: sel }, { status: 201 });
    } catch (err) {
      return NextResponse.json({ error: "Failed to create selection" }, { status: 500 });
    }
  }
} 