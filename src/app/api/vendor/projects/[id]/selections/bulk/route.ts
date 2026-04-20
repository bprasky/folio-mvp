export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/apiAuth";
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectWrite } from '@/lib/authz/access';

export async function POST(req: Request, { params }: { params: { id: string }}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await assertProjectWrite(session.user.id, params.id);

  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;
  const body = await req.json().catch(() => ({}));
  const items: any[] = Array.isArray(body?.items) ? body.items : [];

  const created: any[] = [];
  for (const raw of items) {
    const productName = String(raw.name ?? raw.title ?? "Untitled");
    const unitPrice = raw.price != null ? Number(raw.price) : null;
    const photo = raw.imageUrl ?? raw.photoUrl ?? null;

    // Ensure a Product record exists for the attribution chain
    const linkedProductId = await ensureProductForSelection({
      productName,
      vendorName: null,
      photo,
      unitPrice,
    });

    const data: any = {
      projectId: projectId as any,
      productName,
      // vendor attribution for demo visibility:
      vendorRepId: userId,
      // tolerant mapping
      sku: raw.sku ?? null,
      quantity: raw.quantity != null ? Number(raw.quantity) : 1,
      unitPrice,
      photo,
      notes: raw.notes ?? raw.note ?? null,
      ...(linkedProductId ? { uiMeta: { productId: linkedProductId } } : {}),
    };
    Object.keys(data).forEach(k => (k !== 'uiMeta' && data[k] == null) && delete data[k]);

    try {
      const s = await prisma.selection.create({ data, select: { id: true, productName: true } });
      created.push(s);
    } catch (e:any) {
      console.warn("[DEMO] selection.create skipped:", e?.code || e?.message, data);
    }
  }

  return NextResponse.json({ created }, { status: 201 });
}



