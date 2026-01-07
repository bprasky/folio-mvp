import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';

/**
 * GET /api/projects/[id]/unreal-export
 * 
 * Export all ready 3D assets for a project in a format consumable by Unreal Engine
 * 
 * Returns JSON structure:
 * {
 *   projectId: string,
 *   rooms: [],
 *   assets: [
 *     {
 *       id: string,
 *       glbUrl: string,
 *       source: {
 *         projectImageId: string,
 *         productId?: string
 *       },
 *       placementHint: {
 *         room?: string,
 *         surfaceType?: string
 *       },
 *       meta: {}
 *     }
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;

    // Verify user has access to project
    await assertProjectView(session.user.id, projectId);

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        rooms: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Fetch all ready 3D assets for this project that are marked for export
    const assets = await prisma.threeDAsset.findMany({
      where: {
        projectId,
        status: 'READY',
        includeInUnrealExport: true,
      },
      include: {
        projectImage: {
          select: {
            id: true,
            url: true,
            name: true,
            room: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    // Transform assets to Unreal export format
    const exportAssets = assets.map((asset) => {
      // Extract placement hints from project image room or product category
      const placementHint: {
        room?: string;
        surfaceType?: string;
      } = {};

      if (asset.projectImage?.room) {
        placementHint.room = asset.projectImage.room;
      }

      // Map product category to surface type if applicable
      if (asset.product?.category) {
        const category = asset.product.category.toLowerCase();
        if (category.includes('counter') || category.includes('surface')) {
          placementHint.surfaceType = 'countertop';
        } else if (category.includes('floor')) {
          placementHint.surfaceType = 'floor';
        } else if (category.includes('wall')) {
          placementHint.surfaceType = 'wall';
        }
      }

      return {
        id: asset.id,
        glbUrl: asset.glbUrl,
        source: {
          projectImageId: asset.projectImageId,
          productId: asset.productId || undefined,
        },
        placementHint: Object.keys(placementHint).length > 0 ? placementHint : null,
        meta: asset.meta || {},
      };
    });

    // Build export structure
    const exportData = {
      projectId: project.id,
      projectTitle: project.title,
      rooms: project.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        type: room.type,
      })),
      assets: exportAssets,
      exportedAt: new Date().toISOString(),
    };

    return NextResponse.json(exportData);
  } catch (error: any) {
    console.error('Error exporting Unreal scene:', error);
    
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to export Unreal scene' },
      { status: 500 }
    );
  }
}




