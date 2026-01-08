export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateInterviewSchema = z.object({
  projectId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  vendorBoostRequestId: z.string().optional(),
  mode: z.enum(["AUDIO", "VIDEO"]).default("AUDIO"),
  promptLens: z.string().optional(),
}).refine(
  (data) => data.projectId || data.productId || data.vendorBoostRequestId,
  { message: "Must provide projectId, productId, or vendorBoostRequestId" }
);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const parsed = CreateInterviewSchema.parse(body);

    // Validate project access if projectId provided
    if (parsed.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: parsed.projectId },
        select: { ownerId: true, designerId: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (project.ownerId !== userId && project.designerId !== userId) {
        return NextResponse.json({ error: "Forbidden: not project owner or designer" }, { status: 403 });
      }
    }

    // Validate product access if productId provided
    if (parsed.productId) {
      // For product interviews, we need to check if it's via a vendor boost request
      // or if the user has access to the product
      if (parsed.vendorBoostRequestId) {
        const boostRequest = await prisma.vendorBoostRequest.findUnique({
          where: { id: parsed.vendorBoostRequestId },
          select: { requestedDesignerId: true, productId: true },
        });

        if (!boostRequest) {
          return NextResponse.json({ error: "Vendor boost request not found" }, { status: 404 });
        }

        if (boostRequest.requestedDesignerId !== userId) {
          return NextResponse.json({ error: "Forbidden: not the requested designer" }, { status: 403 });
        }

        if (boostRequest.productId !== parsed.productId) {
          return NextResponse.json({ error: "Product ID mismatch" }, { status: 400 });
        }
      }
    }

    // Validate vendor boost request if provided
    let vendorId: string | undefined;
    if (parsed.vendorBoostRequestId) {
      const boostRequest = await prisma.vendorBoostRequest.findUnique({
        where: { id: parsed.vendorBoostRequestId },
        select: { vendorId: true, requestedDesignerId: true, status: true },
      });

      if (!boostRequest) {
        return NextResponse.json({ error: "Vendor boost request not found" }, { status: 404 });
      }

      if (boostRequest.requestedDesignerId !== userId) {
        return NextResponse.json({ error: "Forbidden: not the requested designer" }, { status: 403 });
      }

      if (boostRequest.status !== "ACCEPTED") {
        return NextResponse.json({ error: "Vendor boost request must be accepted first" }, { status: 400 });
      }

      vendorId = boostRequest.vendorId;
    }

    // Create interview session
    const interviewSession = await prisma.interviewSession.create({
      data: {
        createdByUserId: userId,
        projectId: parsed.projectId || null,
        productId: parsed.productId || null,
        vendorBoostRequestId: parsed.vendorBoostRequestId || null,
        vendorId: vendorId || null,
        mode: parsed.mode,
        promptLens: parsed.promptLens || null,
        status: "DRAFT",
        recordedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        mode: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      interviewSession,
    });
  } catch (error) {
    console.error("[interviews/create] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




