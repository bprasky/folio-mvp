export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/** Helper: verify vendor user has access to the project */
async function verifyVendorProjectAccess(userId: string, projectId: string) {
  const orgUser = await prisma.organizationUser.findFirst({
    where: {
      userId,
      isActive: true,
      organization: {
        type: { in: ['VENDOR', 'MANUFACTURER', 'SHOWROOM'] },
      },
    },
    select: { organizationId: true },
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, vendorOrgId: true },
  });

  if (!project) return { allowed: false as const, reason: 'Project not found', status: 404 };

  const isOwner = project.ownerId === userId;
  const isVendorOrg = orgUser && project.vendorOrgId === orgUser.organizationId;

  if (!isOwner && !isVendorOrg) return { allowed: false as const, reason: 'Forbidden', status: 403 };

  return { allowed: true as const };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyVendorProjectAccess(session.user.id, params.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.status });
    }

    const rooms = await prisma.room.findMany({
      where: { projectId: params.id as any },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({ rooms });
  } catch (e) {
    console.warn("[Rooms GET] failed:", (e as any)?.message);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;

    const access = await verifyVendorProjectAccess(session.user.id, projectId);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: access.status });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        projectId: projectId
      },
      include: {
        selections: true
      }
    });

    console.log('Vendor project room created successfully:', room);
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Error creating vendor project room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
