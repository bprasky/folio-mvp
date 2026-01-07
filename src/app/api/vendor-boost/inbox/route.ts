import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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
    const where: any = {
      requestedDesignerId: userId,
    };

    if (statusFilter) {
      where.status = statusFilter;
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
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            imageUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
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
      requests,
    });
  } catch (error) {
    console.error("[vendor-boost/inbox] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

