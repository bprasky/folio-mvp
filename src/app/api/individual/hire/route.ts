export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { normalizeRole } from '@/lib/permissions';
import { shouldUseDemoMode, getDemoDesignerId } from '@/lib/demo/demoModeGuards';

/**
 * POST /api/individual/hire
 * Creates a project linking an Individual (owner) with a Designer
 * For demo flow: Individual hires Designer, project is created with Individual as owner
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = normalizeRole(session.user.role);
    if (userRole !== 'INDIVIDUAL') {
      return NextResponse.json(
        { error: 'Only Individuals can hire designers' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { designerId, projectTitle, description } = body;

    if (!designerId) {
      return NextResponse.json(
        { error: 'Designer ID is required' },
        { status: 400 }
      );
    }

    // Verify designer exists and has DESIGNER role
    const designer = await prisma.user.findUnique({
      where: { id: designerId },
      select: { id: true, role: true, name: true, email: true },
    });

    if (!designer) {
      return NextResponse.json(
        { error: 'Designer not found' },
        { status: 404 }
      );
    }

    const designerRole = normalizeRole(designer.role);
    if (designerRole !== 'DESIGNER') {
      return NextResponse.json(
        { error: 'Selected user is not a designer' },
        { status: 400 }
      );
    }

    const individualId = session.user.id;
    const title = projectTitle?.trim() || `Project with ${designer.name || 'Designer'}`;

    // Demo mode: ensure we have a valid designer ID
    let finalDesignerId = designerId;
    if (shouldUseDemoMode(session.user.email)) {
      const demoDesignerId = await getDemoDesignerId();
      if (demoDesignerId && designerId === 'designer_001') {
        // Map mock ID to real designer ID in demo mode
        finalDesignerId = demoDesignerId;
      }
    }

    // Best-effort: resolve designer's org for project attribution
    let designerOrgId: string | null = null;
    const designerRecord = await prisma.user.findUnique({
      where: { id: finalDesignerId },
      select: { operatingAsOrgId: true },
    });
    if (designerRecord?.operatingAsOrgId) {
      designerOrgId = designerRecord.operatingAsOrgId;
    } else {
      // Fallback: if designer belongs to exactly one DESIGN_FIRM, use that
      const designFirmMemberships = await prisma.organizationUser.findMany({
        where: { userId: finalDesignerId, isActive: true, organization: { type: 'DESIGN_FIRM' } },
        select: { organizationId: true },
      });
      if (designFirmMemberships.length === 1) {
        designerOrgId = designFirmMemberships[0].organizationId;
      }
    }

    // Create project with Individual as owner, Designer as designer
    const project = await prisma.project.create({
      data: {
        title,
        description: description?.trim() || null,
        ownerId: individualId, // Individual owns the project
        designerId: finalDesignerId, // Designer is assigned
        designerOrgId, // Best-effort from designer's org context
        status: 'draft',
        isPublic: false,
        publishedAt: null,
        isAIEnabled: false,
        clientType: 'RESIDENTIAL',
        views: 0,
        saves: 0,
        shares: 0,
      },
      select: {
        id: true,
        title: true,
        ownerId: true,
        designerId: true,
        createdAt: true,
      },
    });

    // Create ProjectParticipant entries for both Individual (owner) and Designer
    try {
      // Individual as owner
      await prisma.projectParticipant.create({
        data: {
          projectId: project.id,
          userId: individualId,
          side: 'DESIGNER', // Individual is on the client side, but we use DESIGNER side for project participants
          role: 'OWNER',
        },
      });
      
      // Designer as participant
      await prisma.projectParticipant.create({
        data: {
          projectId: project.id,
          userId: finalDesignerId,
          side: 'DESIGNER',
          role: 'EDITOR',
        },
      });
    } catch (participantError: any) {
      // Fail-soft if ProjectParticipant creation fails (schema might not support it yet)
      console.warn('[hire] ProjectParticipant creation skipped:', participantError?.code || participantError?.message);
    }

    // Link Individual's saved items to this project as selections
    // For demo: Create a default room and link any saved products
    try {
      // Create a default room for the project
      const defaultRoom = await prisma.room.create({
        data: {
          name: 'Main Room',
          projectId: project.id,
          type: 'LIVING',
        },
      });

      // Try to find Individual's saved products (from Folder/FolderProduct or ProductTag)
      // For Individuals, saved items might be in folders or as product tags
      const individualFolders = await prisma.folder.findMany({
        where: { designerId: individualId },
        include: {
          products: {
            include: {
              product: true,
            },
            take: 10, // Limit to first 10 saved items for demo
          },
        },
      });

      // Create selections from saved products
      for (const folder of individualFolders) {
        for (const folderProduct of folder.products) {
          if (folderProduct.product) {
            await prisma.selection.create({
              data: {
                projectId: project.id,
                roomId: defaultRoom.id,
                productName: folderProduct.product.name,
                vendorName: folderProduct.product.brand || null,
                photo: folderProduct.product.imageUrl || folderProduct.product.primaryImageUrl || null,
                unitPrice: folderProduct.product.price || null,
                productUrl: folderProduct.product.url || null,
                vendorProductId: folderProduct.product.id,
                source: 'individual_saved_items',
                notes: `Saved from ${folder.name}`,
              },
            });
          }
        }
      }
    } catch (selectionError: any) {
      // Fail-soft: selections are nice-to-have for demo
      console.warn('[hire] Selection creation skipped:', selectionError?.code || selectionError?.message);
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        designerId: project.designerId,
        ownerId: project.ownerId,
      },
      message: 'Project created successfully. Designer can now access the project.',
    });
  } catch (error: any) {
    console.error('[individual/hire] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create project', details: error.message },
      { status: 500 }
    );
  }
}

