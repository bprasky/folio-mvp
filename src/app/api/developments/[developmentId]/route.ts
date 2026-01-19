export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { DevelopmentStatus } from "@prisma/client";

type Params = { params: { developmentId: string } };

/**
 * GET /api/developments/[developmentId]
 *
 * Returns a development with full details including unit types, packages, etc.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id: string; role: string } | undefined;
    const { developmentId } = params;

    const development = await prisma.development.findUnique({
      where: { id: developmentId },
      include: {
        developerOrg: {
          select: {
            id: true,
            name: true,
            logo: true,
            description: true,
          },
        },
        unitTypes: {
          include: {
            rooms: {
              include: {
                finishSlots: true,
              },
            },
            _count: {
              select: { consultations: true },
            },
          },
          orderBy: { bedrooms: 'asc' },
        },
        finishPackages: {
          include: {
            defaultSelections: {
              include: {
                developmentProduct: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                        brand: true,
                        price: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { tier: 'asc' },
        },
        productCatalog: {
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
        },
        designerPool: {
          where: { isActive: true },
          include: {
            designer: {
              select: {
                id: true,
                name: true,
                profileImage: true,
                studio: true,
                bio: true,
              },
            },
          },
        },
        deployments: {
          where: { isActive: true },
          include: {
            fingerprint: {
              select: {
                id: true,
                designerId: true,
                completeness: true,
              },
            },
          },
        },
        _count: {
          select: {
            consultations: true,
            consultationBuyers: true,
          },
        },
      },
    });

    if (!development) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    // Check access - published developments are public, unpublished require org access
    if (!development.publishedAt) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const isAdmin = user.role === 'ADMIN';
      if (!isAdmin) {
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

    return NextResponse.json({ development });

  } catch (error: any) {
    console.error("Error fetching development:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch development" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/developments/[developmentId]
 *
 * Updates a development. Requires org membership.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId } = params;
    const body = await req.json();

    // Fetch existing development
    const existing = await prisma.development.findUnique({
      where: { id: developmentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    // Check authorization
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin) {
      const hasAccess = await prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId: existing.developerOrgId,
          isActive: true,
        },
      });

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = [
      'name', 'description', 'address', 'city', 'state', 'country',
      'totalUnits', 'status', 'expectedCompletion', 'consultationsEnabled',
      'defaultDesignerId', 'heroImageUrl', 'galleryUrls',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'expectedCompletion' && body[field]) {
          updateData[field] = new Date(body[field]);
        } else if (field === 'status' && body[field]) {
          // Validate status enum
          if (!Object.values(DevelopmentStatus).includes(body[field])) {
            return NextResponse.json(
              { error: `Invalid status. Must be one of: ${Object.values(DevelopmentStatus).join(', ')}` },
              { status: 400 }
            );
          }
          updateData[field] = body[field];
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Handle slug separately (check uniqueness)
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await prisma.development.findUnique({
        where: { slug: body.slug },
      });
      if (slugExists) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
      updateData.slug = body.slug;
    }

    // Handle publish/unpublish
    if (body.publish === true && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    } else if (body.publish === false && existing.publishedAt) {
      updateData.publishedAt = null;
    }

    const development = await prisma.development.update({
      where: { id: developmentId },
      data: updateData,
      include: {
        developerOrg: {
          select: { id: true, name: true },
        },
        _count: {
          select: {
            unitTypes: true,
            finishPackages: true,
            productCatalog: true,
            designerPool: true,
          },
        },
      },
    });

    return NextResponse.json({ development });

  } catch (error: any) {
    console.error("Error updating development:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update development" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/developments/[developmentId]
 *
 * Archives (soft-deletes) a development by setting status to SOLD_OUT.
 * Hard delete only if no consultations exist.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string };
    const { developmentId } = params;
    const searchParams = req.nextUrl.searchParams;
    const hardDelete = searchParams.get('hard') === 'true';

    // Fetch existing development
    const existing = await prisma.development.findUnique({
      where: { id: developmentId },
      include: {
        _count: {
          select: { consultations: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Development not found" }, { status: 404 });
    }

    // Check authorization
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin) {
      const hasAccess = await prisma.organizationUser.findFirst({
        where: {
          userId: user.id,
          organizationId: existing.developerOrgId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Forbidden - requires OWNER or ADMIN role in organization" },
          { status: 403 }
        );
      }
    }

    // Hard delete only if no consultations
    if (hardDelete) {
      if (existing._count.consultations > 0) {
        return NextResponse.json(
          { error: "Cannot hard delete - development has consultations. Use soft delete instead." },
          { status: 400 }
        );
      }

      await prisma.development.delete({
        where: { id: developmentId },
      });

      return NextResponse.json({ success: true, message: "Development deleted" });
    }

    // Soft delete - set status to SOLD_OUT and unpublish
    const development = await prisma.development.update({
      where: { id: developmentId },
      data: {
        status: DevelopmentStatus.SOLD_OUT,
        publishedAt: null,
        consultationsEnabled: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Development archived",
      development,
    });

  } catch (error: any) {
    console.error("Error deleting development:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete development" },
      { status: 500 }
    );
  }
}
