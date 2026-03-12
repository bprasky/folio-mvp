import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/events/[id]/my-collection/export
 * Returns structured JSON data for client-side PDF generation.
 * A full server-side PDF solution (e.g., puppeteer) can replace this later.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const eventId = params.id;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });

    if (!event)
      return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const scans = await prisma.eventProductScan.findMany({
      where: { eventId, userId: session.user.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            price: true,
            brand: true,
            category: true,
            vendor: { select: { name: true, companyName: true } },
          },
        },
      },
      orderBy: { scannedAt: "asc" },
    });

    return NextResponse.json({
      eventTitle: event.title,
      exportedAt: new Date().toISOString(),
      productCount: scans.length,
      products: scans.map((s) => ({
        name: s.product.name,
        description: s.product.description,
        imageUrl: s.product.imageUrl,
        price: s.product.price,
        brand: s.product.brand,
        category: s.product.category,
        vendorName:
          s.product.vendor?.companyName || s.product.vendor?.name || null,
        scannedAt: s.scannedAt,
        notes: s.notes,
      })),
    });
  } catch (e) {
    console.error("Collection export error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
