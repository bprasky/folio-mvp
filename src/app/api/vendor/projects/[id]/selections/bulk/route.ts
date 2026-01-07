import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserIdFromRequest } from "@/lib/apiAuth";

export async function POST(req: Request, { params }: { params: { id: string }}) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = params.id;
  const body = await req.json().catch(() => ({}));
  const items: any[] = Array.isArray(body?.items) ? body.items : [];

  const created: any[] = [];
  for (const raw of items) {
    const data: any = {
      projectId: projectId as any,
      productName: String(raw.name ?? raw.title ?? "Untitled"),
      // vendor attribution for demo visibility:
      vendorRepId: userId,
      // tolerant mapping
      sku: raw.sku ?? null,
      quantity: raw.quantity != null ? Number(raw.quantity) : 1,
      unitPrice: raw.price != null ? Number(raw.price) : null,
      photo: raw.imageUrl ?? raw.photoUrl ?? null,
      notes: raw.notes ?? raw.note ?? null,
    };
    Object.keys(data).forEach(k => (data[k] == null) && delete data[k]);

    try {
      const s = await prisma.selection.create({ data, select: { id: true, productName: true } });
      created.push(s);
    } catch (e:any) {
      console.warn("[DEMO] selection.create skipped:", e?.code || e?.message, data);
    }
  }

  return NextResponse.json({ created }, { status: 201 });
}



