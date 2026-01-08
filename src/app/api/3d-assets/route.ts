export const dynamic = 'force-dynamic';

// src/app/api/3d-assets/route.ts
//
// 3D Assets API Route
//
// Used by:
// - MediaSection 3D tab (project media page)
// - ThreeDPreview component
//
// GET: Fetches all 3D assets for a project
// POST: Initiates 3D generation for a project image
//
// Returns empty array on errors (soft failure) to prevent page breakage.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { generate3DFromImage } from '@/lib/clients/roboflowSam3d';

/**
 * POST /api/3d-assets
 * 
 * Request 3D generation for a project image
 * 
 * Body:
 * {
 *   projectId: string,
 *   projectImageId: string,
 *   productId?: string | null
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, projectImageId, productId } = body;

    if (!projectId || !projectImageId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, projectImageId' },
        { status: 400 }
      );
    }

    // Verify user has access to project
    await assertProjectView(session.user.id, projectId);

    // Fetch the project image
    const projectImage = await prisma.projectImage.findUnique({
      where: { id: projectImageId },
      include: { project: true },
    });

    if (!projectImage) {
      return NextResponse.json(
        { error: 'Project image not found' },
        { status: 404 }
      );
    }

    // Verify the image belongs to the project
    if (projectImage.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Project image does not belong to the specified project' },
        { status: 400 }
      );
    }

    // Check if a ThreeDAsset already exists for this image
    const existingAsset = await prisma.threeDAsset.findFirst({
      where: {
        projectImageId,
        projectId,
      },
    });

    if (existingAsset) {
      // Return existing asset
      return NextResponse.json(existingAsset);
    }

    // Create ThreeDAsset record with PROCESSING status
    const threeDAsset = await prisma.threeDAsset.create({
      data: {
        projectId,
        projectImageId,
        productId: productId || null,
        status: 'PROCESSING',
        engine: 'meta_sam3d',
      },
    });

    // Start generation asynchronously (don't await)
    generate3DFromImage(projectImage.url)
      .then(async (result) => {
        // Update asset with results
        await prisma.threeDAsset.update({
          where: { id: threeDAsset.id },
          data: {
            status: 'READY',
            glbUrl: result.glbUrl,
            thumbnailUrl: result.thumbnailUrl,
            meta: result.meta || {},
          },
        });
      })
      .catch(async (error) => {
        console.error('3D generation failed:', error);
        // Update asset with failure status
        await prisma.threeDAsset.update({
          where: { id: threeDAsset.id },
          data: {
            status: 'FAILED',
            meta: {
              error: error.message || 'Unknown error',
              failedAt: new Date().toISOString(),
            },
          },
        });
      });

    // Return the asset immediately (status will be PROCESSING)
    return NextResponse.json(threeDAsset);
  } catch (error: any) {
    console.error('Error creating 3D asset:', error);
    
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create 3D asset' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/3d-assets?projectId=...
 * 
 * Get all 3D assets for a project (optionally filter by status)
 * Returns empty array on errors (soft failure for demo robustness)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ assets: [] }, { status: 200 }); // Soft fail
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');

    if (!projectId) {
      console.warn('[3D ASSETS] Missing projectId parameter');
      return NextResponse.json({ assets: [] }, { status: 200 }); // Soft fail
    }

    // Verify user has access to project
    try {
      await assertProjectView(session.user.id, projectId);
    } catch (accessError: any) {
      if (accessError.message === 'Forbidden') {
        return NextResponse.json({ assets: [] }, { status: 200 }); // Soft fail
      }
      throw accessError;
    }

    // Build where clause
    const where: any = { projectId };
    if (status && ['PENDING', 'PROCESSING', 'READY', 'FAILED'].includes(status)) {
      where.status = status;
    }

    // Fetch assets
    const assets = await prisma.threeDAsset.findMany({
      where,
      include: {
        projectImage: {
          select: {
            id: true,
            url: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ assets }, { status: 200 });
  } catch (error: any) {
    console.error('[3D ASSETS] Failed to load assets:', {
      projectId: new URL(request.url).searchParams.get('projectId'),
      error: error.message || 'Unknown error',
      stack: error.stack,
    });

    // Return empty array instead of 500 (soft failure)
    return NextResponse.json(
      { assets: [], error: 'Failed to load 3D assets' },
      { status: 200 }
    );
  }
}

