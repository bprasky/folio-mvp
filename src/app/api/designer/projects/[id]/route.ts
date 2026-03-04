export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView } from '@/lib/authz/access';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.id);

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        rooms: {
          include: {
            selections: true
          }
        },
        images: {
          select: {
            id: true,
            url: true,
            room: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        designer: {
          select: {
            id: true,
            name: true,
            email: true
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

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project', details: error instanceof Error ? error.message : 'Unknown error' },
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
    await assertProjectView(session.user.id, params.id);

    const body = await request.json();
    const { isPublic, status } = body;

    const updateData: any = {};
    if (typeof isPublic === 'boolean') updateData.isPublic = isPublic;
    if (status) updateData.status = status;

    const project = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
      include: {
        rooms: {
          include: {
            selections: true
          }
        }
      }
    });

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 