// @idor-allow: IDOR003 reason="Access gated by canAccessCheckIn or active check-in RSVP; scan records are self-scoped"
// @idor-allow: IDOR004 reason="Same as IDOR003; mutations operate on scans tied to session.user.id"
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";
import { recordSave } from "@/lib/intelligence/signals";
import { logSignal } from "@/lib/telemetry/context-signal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const eventId = params.id;
    const userId = session.user.id;
    const { productId, scanMethod, notes } = await req.json();

    if (!productId)
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });

    // Auth: user must be checked in OR have staff access
    const isStaff = await canAccessCheckIn(userId, session.user.role, eventId);
    if (!isStaff) {
      const rsvp = await prisma.eventRSVP.findFirst({
        where: { eventId, userId, checkedInAt: { not: null } },
        select: { id: true },
      });
      if (!rsvp)
        return NextResponse.json(
          { error: "Must be checked in to scan products" },
          { status: 403 }
        );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        price: true,
        category: true,
        brand: true,
        vendor: { select: { id: true, name: true, companyName: true } },
      },
    });
    if (!product)
      return NextResponse.json({ status: "product_not_found" }, { status: 404 });

    const vendorName =
      product.vendor?.companyName || product.vendor?.name || null;

    // Check if already scanned
    const existing = await prisma.eventProductScan.findUnique({
      where: { eventId_userId_productId: { eventId, userId, productId } },
    });

    if (existing) {
      return NextResponse.json({
        status: "product_already_scanned",
        product: {
          id: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          vendorName,
          price: product.price,
        },
      });
    }

    // Auto-save via recordSave (handles deduplication + taste profile)
    const saveResult = await recordSave({
      userId,
      productId,
      source: "EVENT_SCAN",
      meta: { eventId },
    });

    // Create the scan record
    const scan = await prisma.eventProductScan.create({
      data: {
        eventId,
        userId,
        productId,
        scanMethod: scanMethod || "qr",
        notes: notes || null,
        autoSavedId: saveResult.saveId || null,
      },
    });

    // Fire context signal
    logSignal({
      userId,
      productId,
      eventId,
      vendorId: product.vendor?.id,
      action: "EVENT_PRODUCT_SCAN",
      tags: [product.category, product.brand].filter(Boolean) as string[],
      meta: { scanId: scan.id, scanMethod: scanMethod || "qr" },
    });

    // Increment EventProductStat
    if (saveResult.isNew) {
      await prisma.eventProductStat
        .upsert({
          where: { eventId_productId: { eventId, productId } },
          create: { eventId, productId, saves: 1 },
          update: { saves: { increment: 1 } },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      status: "product_scanned",
      product: {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        vendorName,
        price: product.price,
      },
    });
  } catch (e) {
    console.error("Product scan error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
