import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

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

    const scans = await prisma.eventProductScan.findMany({
      where: { eventId: params.id, userId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            price: true,
            vendor: { select: { name: true, companyName: true } },
          },
        },
      },
      orderBy: { scannedAt: "desc" },
    });

    return NextResponse.json({
      scans: scans.map((s) => ({
        id: s.id,
        productId: s.productId,
        scanMethod: s.scanMethod,
        scannedAt: s.scannedAt,
        notes: s.notes,
        product: {
          id: s.product.id,
          name: s.product.name,
          imageUrl: s.product.imageUrl,
          vendorName:
            s.product.vendor?.companyName || s.product.vendor?.name || null,
          price: s.product.price,
        },
      })),
    });
  } catch (e) {
    console.error("My scans error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
