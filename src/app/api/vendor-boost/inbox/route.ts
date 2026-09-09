export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma, VendorBoostRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get("status") as
      | "PENDING"
      | "ACCEPTED"
      | "COMPLETED"
      | "DECLINED"
      | "EXPIRED"
      | null;

    // Build where clause
    const where: Prisma.VendorBoostRequestWhereInput = {
      requestedDesignerId: userId,
    };

    if (statusFilter) {
      if (!['PENDING','ACCEPTED','COMPLETED','DECLINED','EXPIRED'].includes(statusFilter)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      where.status = statusFilter as VendorBoostRequestStatus;
    }

    // Fetch boost requests for this designer
    const requests = await prisma.vendorBoostRequest.findMany({
      where,
      orderBy: {
        requestedAt: "desc",
      },
      select: {
        id: true,
        status: true,
        message: true,
        requestedAt: true,
        expiresAt: true,
        acceptedAt: true,
        declinedAt: true,
        completedAt: true,
        products: {
          select: {
            id: true,
            name: true,
            brand: true,
            imageUrl: true,
          },
        },
        projects: {
          select: {
            id: true,
            title: true,
            post: { select: { slug: true } },
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        interviewSession: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      requests: requests.map(({ products, projects, ...request }) => ({ ...request, product: products, project: projects })),
    });
  } catch (error) {
    console.error("[vendor-boost/inbox] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

