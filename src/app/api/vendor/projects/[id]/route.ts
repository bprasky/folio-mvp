export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

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

    // Verify the user has vendor org access to this project
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: {
          type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
        },
      },
      select: { organizationId: true },
    });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        rooms: {
          include: {
            selections: true
          }
        },
        selections: {
          include: {
            room: true
          }
        },
        _count: {
          select: {
            rooms: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check that the vendor user owns the project or their org is linked
    const isOwner = project.ownerId === session.user.id;
    const isVendorOrg = orgUser && project.vendorOrgId === orgUser.organizationId;
    if (!isOwner && !isVendorOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching vendor project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;

    // Verify the user has vendor org access to this project
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        organization: {
          type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
        },
      },
      select: { organizationId: true },
    });

    // Check project exists and user has access
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, vendorOrgId: true },
    });

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = existingProject.ownerId === session.user.id;
    const isVendorOrg = orgUser && existingProject.vendorOrgId === orgUser.organizationId;
    if (!isOwner && !isVendorOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const project = await prisma.project.update({
      where: { id: projectId },
      data: body,
      include: {
        rooms: {
          include: {
            selections: true
          }
        },
        _count: {
          select: {
            rooms: true
          }
        }
      }
    });

    console.log('Vendor project updated successfully:', project);
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error updating vendor project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}
