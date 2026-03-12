import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import prisma from "@/lib/prisma";
import { canAccessCheckIn } from "@/lib/events/checkInAccess";
import { getEventScanConversions } from "@/lib/events/scanAttribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const eventId = params.id;
    const vendorId = req.nextUrl.searchParams.get("vendorId");

    // Staff or vendor with products at event
    const isStaff = await canAccessCheckIn(
      session.user.id,
      session.user.role,
      eventId
    );
    if (!isStaff && !vendorId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Build scan query
    const scanWhere: any = { eventId };
    if (vendorId) {
      const vendorProducts = await prisma.product.findMany({
        where: { vendorId },
        select: { id: true },
      });
      scanWhere.productId = { in: vendorProducts.map((p) => p.id) };
    }

    const scans = await prisma.eventProductScan.findMany({
      where: scanWhere,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            vendor: { select: { name: true, companyName: true } },
          },
        },
        user: { select: { id: true, name: true, role: true } },
      },
    });

    const totalScans = scans.length;
    const uniqueScannerIds = new Set(scans.map((s) => s.userId));
    const uniqueScanners = uniqueScannerIds.size;

    // Per-product breakdown
    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        vendorName: string;
        scanners: Set<string>;
        scannerRoles: { designers: number; individuals: number; other: number };
        hotLeads: { designerName: string; scannedAt: Date; userId: string }[];
      }
    >();

    for (const scan of scans) {
      const pid = scan.productId;
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          productId: pid,
          productName: scan.product.name,
          vendorName:
            scan.product.vendor?.companyName ||
            scan.product.vendor?.name ||
            "Unknown",
          scanners: new Set(),
          scannerRoles: { designers: 0, individuals: 0, other: 0 },
          hotLeads: [],
        });
      }
      const entry = productMap.get(pid)!;
      if (!entry.scanners.has(scan.userId)) {
        entry.scanners.add(scan.userId);
        const role = scan.user?.role;
        if (role === "DESIGNER") {
          entry.scannerRoles.designers++;
          entry.hotLeads.push({
            designerName: scan.user?.name || "Unknown",
            scannedAt: scan.scannedAt,
            userId: scan.userId,
          });
        } else if (role === "INDIVIDUAL") {
          entry.scannerRoles.individuals++;
        } else {
          entry.scannerRoles.other++;
        }
      }
    }

    // Get active project counts for hot leads
    const designerIds = [
      ...new Set(
        [...productMap.values()].flatMap((p) =>
          p.hotLeads.map((h) => h.userId)
        )
      ),
    ];
    const projectCounts =
      designerIds.length > 0
        ? await prisma.project.groupBy({
            by: ["userId"],
            where: { userId: { in: designerIds } },
            _count: true,
          })
        : [];
    const projectCountMap = new Map(
      projectCounts.map((p) => [p.userId, p._count])
    );

    const products = [...productMap.values()]
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        vendorName: p.vendorName,
        scanCount: scans.filter((s) => s.productId === p.productId).length,
        uniqueScanners: p.scanners.size,
        scannerBreakdown: p.scannerRoles,
        hotLeads: p.hotLeads
          .map((h) => ({
            designerName: h.designerName,
            activeProjects: projectCountMap.get(h.userId) || 0,
            scannedAt: h.scannedAt,
          }))
          .sort((a, b) => b.activeProjects - a.activeProjects)
          .slice(0, 10),
      }))
      .sort((a, b) => b.scanCount - a.scanCount);

    // Timeline: 15-min buckets
    const buckets: Record<string, number> = {};
    for (const scan of scans) {
      const d = new Date(scan.scannedAt);
      const minutes = Math.floor(d.getMinutes() / 15) * 15;
      d.setMinutes(minutes, 0, 0);
      const key = d.toISOString();
      buckets[key] = (buckets[key] || 0) + 1;
    }
    const timeline = Object.entries(buckets)
      .map(([bucket, scanCount]) => ({ bucket, scanCount }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    // Top scanners
    const scannerCounts = new Map<
      string,
      { userName: string; role: string; count: number }
    >();
    for (const scan of scans) {
      const uid = scan.userId;
      if (!scannerCounts.has(uid)) {
        scannerCounts.set(uid, {
          userName: scan.user?.name || "Unknown",
          role: scan.user?.role || "UNKNOWN",
          count: 0,
        });
      }
      scannerCounts.get(uid)!.count++;
    }
    const topScanners = [...scannerCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((s) => ({
        userName: s.userName,
        role: s.role,
        scanCount: s.count,
      }));

    // Conversion metrics
    const conversions = await getEventScanConversions(eventId);

    return NextResponse.json({
      totalScans,
      uniqueScanners,
      products,
      timeline,
      topScanners,
      conversions,
    });
  } catch (e) {
    console.error("Scan analytics error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
