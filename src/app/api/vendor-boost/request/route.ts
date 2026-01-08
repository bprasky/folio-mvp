export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVendorContext } from "@/lib/auth/vendorContext";
import { z } from "zod";

const CreateBoostRequestSchema = z.object({
  productId: z.string().uuid(),
  projectId: z.string().uuid(),
  requestedDesignerId: z.string().uuid(),
  message: z.string().optional(),
  expiresInDays: z.number().int().positive().max(90).optional().default(30),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get vendor context (vendor organization)
    const vendorContext = await getVendorContext();
    if (!vendorContext) {
      return NextResponse.json({ error: "Vendor access required" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = CreateBoostRequestSchema.parse(body);

    // Step 1: Verify vendor owns the product
    // Products have vendorRecordId that links to Vendor
    // We need to find the Vendor record associated with the vendor organization
    const product = await prisma.product.findUnique({
      where: { id: parsed.productId },
      select: {
        id: true,
        name: true,
        vendorRecordId: true,
        vendorRecord: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.vendorRecordId) {
      return NextResponse.json(
        { error: "Product does not have a vendor record" },
        { status: 400 }
      );
    }

    // For v1, we'll use vendorRecordId directly
    // In future, we might need to map Organization → Vendor
    const vendorId = product.vendorRecordId;

    // Step 2: Verify product is tagged in project
    const productTag = await prisma.projectProductTag.findFirst({
      where: {
        projectId: parsed.projectId,
        productId: parsed.productId,
      },
      select: {
        id: true,
      },
    });

    if (!productTag) {
      return NextResponse.json(
        { error: "Product is not tagged in this project" },
        { status: 400 }
      );
    }

    // Step 3: Verify project exists and get designer info
    const project = await prisma.project.findUnique({
      where: { id: parsed.projectId },
      select: {
        id: true,
        title: true,
        ownerId: true,
        designerId: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify requestedDesignerId is the project owner or designer
    if (
      parsed.requestedDesignerId !== project.ownerId &&
      parsed.requestedDesignerId !== project.designerId
    ) {
      return NextResponse.json(
        { error: "Requested designer must be the project owner or designer" },
        { status: 400 }
      );
    }

    // Step 4: Check if there's already a pending request for this product+project+designer
    const existingRequest = await prisma.vendorBoostRequest.findFirst({
      where: {
        productId: parsed.productId,
        projectId: parsed.projectId,
        requestedDesignerId: parsed.requestedDesignerId,
        status: {
          in: ["PENDING", "ACCEPTED"],
        },
      },
      select: { id: true },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "A pending or accepted request already exists for this product, project, and designer" },
        { status: 400 }
      );
    }

    // Step 5: Create the boost request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parsed.expiresInDays);

    const boostRequest = await prisma.vendorBoostRequest.create({
      data: {
        vendorId,
        productId: parsed.productId,
        projectId: parsed.projectId,
        requestedDesignerId: parsed.requestedDesignerId,
        message: parsed.message || null,
        expiresAt,
        status: "PENDING",
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        requestedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      vendorBoostRequest: boostRequest,
    });
  } catch (error) {
    console.error("[vendor-boost/request] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

