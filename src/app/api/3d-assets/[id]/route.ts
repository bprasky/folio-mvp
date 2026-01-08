export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';

/**
 * GET /api/3d-assets/[id]
 * 
 * Get a single 3D asset by ID
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

    const asset = await prisma.threeDAsset.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: { id: true },
        },
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
    });

    if (!asset) {
      return NextResponse.json(
        { error: '3D asset not found' },
        { status: 404 }
      );
    }

    // Verify user has access to the project
    if (asset.projectId) {
      await assertProjectView(session.user.id, asset.projectId);
    }

    return NextResponse.json(asset);
  } catch (error: any) {
    console.error('Error fetching 3D asset:', error);
    
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to fetch 3D asset' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/3d-assets/[id]
 * 
 * Update a 3D asset (e.g., toggle includeInUnrealExport)
 * 
 * Body:
 * {
 *   includeInUnrealExport?: boolean
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { includeInUnrealExport } = body;

    // Fetch asset to verify access
    const asset = await prisma.threeDAsset.findUnique({
      where: { id: params.id },
      select: { projectId: true },
    });

    if (!asset) {
      return NextResponse.json(
        { error: '3D asset not found' },
        { status: 404 }
      );
    }

    // Verify user has access to the project
    if (asset.projectId) {
      await assertProjectView(session.user.id, asset.projectId);
    }

    // Build update data
    const updateData: any = {};
    if (typeof includeInUnrealExport === 'boolean') {
      updateData.includeInUnrealExport = includeInUnrealExport;
    }

    // Update asset
    const updatedAsset = await prisma.threeDAsset.update({
      where: { id: params.id },
      data: updateData,
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
    });

    return NextResponse.json(updatedAsset);
  } catch (error: any) {
    console.error('Error updating 3D asset:', error);
    
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update 3D asset' },
      { status: 500 }
    );
  }
}




