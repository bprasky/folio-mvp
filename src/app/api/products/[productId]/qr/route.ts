import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true, name: true },
    });

    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const QRCode = await import("qrcode");
    const qrPayload = `folio://product/${product.id}`;

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 300,
      margin: 2,
      color: { dark: "#1c1917", light: "#ffffff" },
    });

    return NextResponse.json({
      qrDataUrl,
      productId: product.id,
      productName: product.name,
      payload: qrPayload,
    });
  } catch (e) {
    console.error("QR generation error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
