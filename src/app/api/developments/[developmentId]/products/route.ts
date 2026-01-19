export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { FinishPackageTier } from "@prisma/client";

type Params = { params: { developmentId: string } };

/**
 * POST /api/developments/[developmentId]/products
 *
 * Adds a product to the development's constrained catalog.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId } = params;
    const body = await req.json();

    // Check development access
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, developerOrgId: true },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    if (user.role !== 'ADMIN') {
      const hasAccess = await prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId: development.developerOrgId,
          isActive: true,
        },
      });
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const {
      productId,
      availableInPackages = [FinishPackageTier.STANDARD],
      isUpgrade = false,
      upgradePriceCents,
      allowedSlots = [],
    } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if product already in catalog
    const existing = await prisma.developmentProduct.findUnique({
      where: {
        developmentId_productId: {
          developmentId,
          productId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Product already in development catalog" },
        { status: 409 }
      );
    }

    // Validate package tiers
    const validTiers = Object.values(FinishPackageTier);
    for (const tier of availableInPackages) {
      if (!validTiers.includes(tier)) {
        return NextResponse.json(
          { error: `Invalid tier: ${tier}. Valid tiers: ${validTiers.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const developmentProduct = await prisma.developmentProduct.create({
      data: {
        developmentId,
        productId,
        availableInPackages,
        isUpgrade,
        upgradePriceCents,
        allowedSlots,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            category: true,
            brand: true,
            price: true,
          },
        },
      },
    });

    return NextResponse.json({ developmentProduct }, { status: 201 });

  } catch (error: any) {
    console.error("Error adding product to catalog:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to add product" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/developments/[developmentId]/products
 *
 * Lists all products in the development's catalog.
 *
 * Query params:
 *   - tier: Filter by package tier
 *   - slot: Filter by allowed slot
 *   - isUpgrade: Filter by upgrade status
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { developmentId } = params;
    const searchParams = req.nextUrl.searchParams;
    const tier = searchParams.get('tier') as FinishPackageTier | null;
    const slot = searchParams.get('slot');
    const isUpgrade = searchParams.get('isUpgrade');

    // Check development exists
    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      select: { id: true, publishedAt: true, developerOrgId: true },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    // For unpublished, check auth
    if (!development.publishedAt) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = session.user as { id: string; role: string };
      if (user.role !== 'ADMIN') {
        const hasAccess = await prisma.organizationUser.findFirst({
          where: {
            userId: user.id,
            organizationId: development.developerOrgId,
            isActive: true,
          },
        });
        if (!hasAccess) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Build where clause
    const where: any = { developmentId };

    if (tier) {
      where.availableInPackages = { has: tier };
    }

    if (slot) {
      where.allowedSlots = { has: slot };
    }

    if (isUpgrade !== null) {
      where.isUpgrade = isUpgrade === 'true';
    }

    const products = await prisma.developmentProduct.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            category: true,
            brand: true,
            price: true,
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            finishPackageDefaults: true,
            consultationSelections: true,
          },
        },
      },
      orderBy: [{ product: { category: 'asc' } }, { product: { name: 'asc' } }],
    });

    return NextResponse.json({ products });

  } catch (error: any) {
    console.error("Error listing catalog products:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list products" },
      { status: 500 }
    );
  }
}
