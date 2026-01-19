export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

type Params = { params: { deploymentId: string } };

/**
 * GET /api/atelier/deployments/[deploymentId]
 *
 * Returns a specific deployment with full context.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { deploymentId } = params;
    const user = session.user as { id: string; role: string };

    const deployment = await prisma.atelierDeployment.findUnique({
      where: { id: deploymentId },
      include: {
        fingerprint: {
          include: {
            nodes: true,
            edges: {
              include: {
                sourceNode: true,
                targetNode: true,
              }
            }
          }
        },
        development: {
          select: {
            id: true,
            name: true,
            slug: true,
            consultationsEnabled: true,
            productCatalog: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    imageUrl: true,
                    brand: true,
                    price: true,
                  }
                }
              }
            },
            finishPackages: true,
            unitTypes: {
              include: {
                rooms: {
                  include: {
                    finishSlots: true,
                  }
                }
              }
            }
          }
        },
        consultations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true,
          }
        }
      },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    // Authorization check
    const isDesigner = deployment.fingerprint.designerId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isDesigner && !isAdmin && deployment.developmentId) {
      // Check if user has access to this development
      const development = await prisma.development.findUnique({
        where: { id: deployment.developmentId },
        include: {
          developerOrg: {
            include: {
              users: {
                where: { userId: user.id }
              }
            }
          }
        }
      });

      const hasOrgAccess = development?.developerOrg.users.length ?? 0 > 0;
      if (!hasOrgAccess) {
        return NextResponse.json(
          { error: "Forbidden - not authorized to view this deployment" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ deployment });

  } catch (error: any) {
    console.error("Error fetching Atelier deployment:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch deployment",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}

/**
 * PATCH /api/atelier/deployments/[deploymentId]
 *
 * Updates a deployment's configuration.
 *
 * Body:
 *   - contextPrompt?: string - update the context prompt
 *   - config?: object - update configuration
 *   - isActive?: boolean - activate/deactivate
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { deploymentId } = params;
    const user = session.user as { id: string; role: string };
    const body = await req.json();

    const { contextPrompt, config, isActive } = body;

    // Fetch deployment for authorization
    const existingDeployment = await prisma.atelierDeployment.findUnique({
      where: { id: deploymentId },
      include: {
        fingerprint: true,
      }
    });

    if (!existingDeployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    // Authorization check
    const isDesigner = existingDeployment.fingerprint.designerId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isDesigner && !isAdmin) {
      // Check if user has access via development
      if (existingDeployment.developmentId) {
        const development = await prisma.development.findUnique({
          where: { id: existingDeployment.developmentId },
          include: {
            developerOrg: {
              include: {
                users: {
                  where: { userId: user.id }
                }
              }
            }
          }
        });

        const hasOrgAccess = development?.developerOrg.users.length ?? 0 > 0;
        if (!hasOrgAccess) {
          return NextResponse.json(
            { error: "Forbidden - not authorized to update this deployment" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Forbidden - only the designer or admin can update this deployment" },
          { status: 403 }
        );
      }
    }

    // Build update data
    const updateData: any = {};

    if (contextPrompt !== undefined) {
      updateData.contextPrompt = contextPrompt;
    }

    if (config !== undefined) {
      // Merge with existing config
      updateData.config = {
        ...(existingDeployment.config as object || {}),
        ...config,
      };
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const deployment = await prisma.atelierDeployment.update({
      where: { id: deploymentId },
      data: updateData,
      include: {
        fingerprint: {
          select: {
            id: true,
            designerId: true,
            completeness: true,
            version: true,
          }
        },
        development: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
      },
    });

    return NextResponse.json({
      success: true,
      deployment,
    });

  } catch (error: any) {
    console.error("Error updating Atelier deployment:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to update deployment",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}

/**
 * DELETE /api/atelier/deployments/[deploymentId]
 *
 * Deactivates (soft-deletes) a deployment.
 * Note: We don't hard delete to preserve consultation history.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { deploymentId } = params;
    const user = session.user as { id: string; role: string };

    // Fetch deployment for authorization
    const existingDeployment = await prisma.atelierDeployment.findUnique({
      where: { id: deploymentId },
      include: {
        fingerprint: true,
        _count: {
          select: {
            consultations: true,
          }
        }
      }
    });

    if (!existingDeployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    // Authorization check
    const isDesigner = existingDeployment.fingerprint.designerId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isDesigner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - only the designer or admin can delete this deployment" },
        { status: 403 }
      );
    }

    // Soft delete by setting isActive to false
    const deployment = await prisma.atelierDeployment.update({
      where: { id: deploymentId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Deployment deactivated",
      consultationsPreserved: existingDeployment._count.consultations,
    });

  } catch (error: any) {
    console.error("Error deleting Atelier deployment:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to delete deployment",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}
