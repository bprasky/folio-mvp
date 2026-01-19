export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { AtelierDeploymentType, AtelierOwnerType } from "@prisma/client";

/**
 * POST /api/atelier/deployments
 *
 * Creates a new Atelier deployment.
 * This deploys a designer's fingerprint into a specific context (e.g., a development).
 *
 * Body:
 *   - designerId: string (required) - the designer whose fingerprint to deploy
 *   - deploymentType: AtelierDeploymentType (required)
 *   - developmentId?: string - required if deploymentType is DEVELOPMENT_CONSULTATION
 *   - contextPrompt?: string - additional context for AI prompts
 *   - config?: object - deployment configuration (temperature, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as { id: string; role: string };
    const body = await req.json();

    const {
      designerId,
      deploymentType,
      developmentId,
      contextPrompt,
      config,
    } = body;

    // Validate required fields
    if (!designerId) {
      return NextResponse.json(
        { error: "designerId is required" },
        { status: 400 }
      );
    }

    if (!deploymentType || !Object.values(AtelierDeploymentType).includes(deploymentType)) {
      return NextResponse.json(
        { error: "Valid deploymentType is required (DEVELOPMENT_CONSULTATION, VENDOR_CONFIGURATOR, DESIGNER_ASSISTANT)" },
        { status: 400 }
      );
    }

    // Validate development ID for development consultations
    if (deploymentType === AtelierDeploymentType.DEVELOPMENT_CONSULTATION && !developmentId) {
      return NextResponse.json(
        { error: "developmentId is required for DEVELOPMENT_CONSULTATION deployments" },
        { status: 400 }
      );
    }

    // Find the designer's fingerprint
    const fingerprint = await prisma.atelierFingerprint.findFirst({
      where: {
        designerId,
        ownerType: AtelierOwnerType.DESIGNER,
      },
    });

    if (!fingerprint) {
      return NextResponse.json(
        { error: "Fingerprint not found for this designer. Run fingerprint computation first." },
        { status: 404 }
      );
    }

    // Authorization: Only the designer, admin, or development owner can create deployments
    const isDesigner = designerId === user.id;
    const isAdmin = user.role === 'ADMIN';

    if (!isDesigner && !isAdmin) {
      // Check if user has permission for this development
      if (developmentId) {
        const development = await prisma.development.findUnique({
          where: { id: developmentId },
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

        if (!development) {
          return NextResponse.json(
            { error: "Development not found" },
            { status: 404 }
          );
        }

        const hasOrgAccess = development.developerOrg.users.length > 0;
        if (!hasOrgAccess) {
          return NextResponse.json(
            { error: "Forbidden - not authorized to create deployments for this development" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Forbidden - only the designer or admin can create this deployment" },
          { status: 403 }
        );
      }
    }

    // Check if there's already an active deployment for this fingerprint + development
    if (developmentId) {
      const existingDeployment = await prisma.atelierDeployment.findFirst({
        where: {
          fingerprintId: fingerprint.id,
          developmentId,
          isActive: true,
        },
      });

      if (existingDeployment) {
        return NextResponse.json(
          {
            error: "Active deployment already exists for this fingerprint and development",
            existingDeploymentId: existingDeployment.id,
          },
          { status: 409 }
        );
      }
    }

    // Create the deployment
    const deployment = await prisma.atelierDeployment.create({
      data: {
        fingerprintId: fingerprint.id,
        deploymentType,
        developmentId,
        contextPrompt,
        config: config || {},
        isActive: true,
      },
      include: {
        fingerprint: {
          select: {
            id: true,
            designerId: true,
            completeness: true,
            version: true,
          }
        },
        development: developmentId ? {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        } : false,
      },
    });

    // Also add the designer to the development's designer pool if not already there
    if (developmentId) {
      await prisma.developmentDesigner.upsert({
        where: {
          developmentId_designerId: {
            developmentId,
            designerId,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          developmentId,
          designerId,
          consultationFeeShare: 0.7, // Default 70% to designer
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      deployment,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating Atelier deployment:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to create deployment",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}

/**
 * GET /api/atelier/deployments
 *
 * Lists deployments for the current user or a specific development.
 *
 * Query params:
 *   - designerId: string - filter by designer (defaults to current user if DESIGNER role)
 *   - developmentId: string - filter by development
 *   - isActive: boolean - filter by active status (default true)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as { id: string; role: string };
    const searchParams = req.nextUrl.searchParams;

    const designerId = searchParams.get('designerId') || (user.role === 'DESIGNER' ? user.id : null);
    const developmentId = searchParams.get('developmentId');
    const isActive = searchParams.get('isActive') !== 'false';

    // Build where clause
    const where: any = { isActive };

    if (designerId) {
      // Find fingerprint for this designer first
      const fingerprint = await prisma.atelierFingerprint.findFirst({
        where: {
          designerId,
          ownerType: AtelierOwnerType.DESIGNER,
        },
      });

      if (fingerprint) {
        where.fingerprintId = fingerprint.id;
      } else {
        // No fingerprint means no deployments
        return NextResponse.json({ deployments: [] });
      }
    }

    if (developmentId) {
      where.developmentId = developmentId;
    }

    // Authorization: Non-admins can only see their own deployments or deployments for their developments
    if (user.role !== 'ADMIN' && !designerId) {
      // Need to filter by developments the user has access to
      const userOrgs = await prisma.organizationUser.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      const orgIds = userOrgs.map(o => o.organizationId);

      const accessibleDevelopments = await prisma.development.findMany({
        where: { developerOrgId: { in: orgIds } },
        select: { id: true },
      });

      where.developmentId = { in: accessibleDevelopments.map(d => d.id) };
    }

    const deployments = await prisma.atelierDeployment.findMany({
      where,
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
        _count: {
          select: {
            consultations: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ deployments });

  } catch (error: any) {
    console.error("Error listing Atelier deployments:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to list deployments",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}
