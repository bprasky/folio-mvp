export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { FinishPackageTier } from "@prisma/client";

type Params = { params: { developmentId: string; productId: string } };

/**
 * PATCH /api/developments/[developmentId]/products/[productId]
 *
 * Updates a product's availability in the catalog.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, productId } = params;
    const body = await req.json();

    // Find the development product (junction record)
    const existing = await prisma.developmentProduct.findUnique({
      where: {
        developmentId_productId: {
          developmentId,
          productId,
        },
      },
      include: {
        development: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not in catalog" }, { status: 404 });
    }

    // Check access
    if (user.role !== 'ADMIN') {
      const hasAccess = await prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId: existing.development.developerOrgId,
          isActive: true,
        },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Build update data
    const updateData: any = {};

    if (body.availableInPackages !== undefined) {
      // Validate tiers
      const validTiers = Object.values(FinishPackageTier);
      for (const tier of body.availableInPackages) {
        if (!validTiers.includes(tier)) {
          return NextResponse.json(
            { error: `Invalid tier: ${tier}` },
            { status: 400 }
          );
        }
      }
      updateData.availableInPackages = body.availableInPackages;
    }

    if (body.isUpgrade !== undefined) {
      updateData.isUpgrade = body.isUpgrade;
    }

    if (body.upgradePriceCents !== undefined) {
      updateData.upgradePriceCents = body.upgradePriceCents;
    }

    if (body.allowedSlots !== undefined) {
      updateData.allowedSlots = body.allowedSlots;
    }

    const developmentProduct = await prisma.developmentProduct.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            category: true,
            brand: true,
            price: true,
          },
        },
      },
    });

    return NextResponse.json({ developmentProduct });

  } catch (error: any) {
    console.error("Error updating catalog product:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developments/[developmentId]/products/[productId]
 *
 * Removes a product from the catalog.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId, productId } = params;

    // Find the development product
    const existing = await prisma.developmentProduct.findUnique({
      where: {
        developmentId_productId: {
          developmentId,
          productId,
        },
      },
      include: {
        development: true,
        _count: {
          select: {
            finishPackageDefaults: true,
            consultationSelections: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Product not in catalog" }, { status: 404 });
    }

    // Check access
    if (user.role !== 'ADMIN') {
      const hasAccess = await prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId: existing.development.developerOrgId,
          isActive: true,
        },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Warn if product is used in defaults or selections
    if (existing._count.finishPackageDefaults > 0 || existing._count.consultationSelections > 0) {
      return NextResponse.json(
        {
          error: "Cannot remove product - it is used in finish package defaults or consultation selections",
          usedIn: {
            finishPackageDefaults: existing._count.finishPackageDefaults,
            consultationSelections: existing._count.consultationSelections,
          },
        },
        { status: 400 }
      );
    }

    await prisma.developmentProduct.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true, message: "Product removed from catalog" });

  } catch (error: any) {
    console.error("Error removing catalog product:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove product" },
      { status: 500 }
    );
  }
}
