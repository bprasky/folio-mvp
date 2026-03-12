import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const eventId = params.id;
    const allowed = await canAccessCheckIn(
      session.user.id,
      session.user.role,
      eventId
    );
    if (!allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get products linked to this event
    const eventProducts = await prisma.event_products.findMany({
      where: { eventId },
      select: { productId: true },
    });

    const productIds = eventProducts.map((ep) => ep.productId);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        vendor: { select: { name: true, companyName: true } },
      },
    });

    const QRCode = await import("qrcode");

    const qrCodes = await Promise.all(
      products.map(async (product) => {
        const qrPayload = `folio://product/${product.id}`;
        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
          width: 300,
          margin: 2,
          color: { dark: "#1c1917", light: "#ffffff" },
        });
        return {
          productId: product.id,
          productName: product.name,
          vendorName:
            product.vendor?.companyName || product.vendor?.name || null,
          qrDataUrl,
        };
      })
    );

    return NextResponse.json({ productQrs: qrCodes });
  } catch (e) {
    console.error("Bulk QR generation error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
