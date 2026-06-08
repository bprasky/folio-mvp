export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView, assertProjectWrite } from '@/lib/authz/access';

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

    const projectId = params.id;

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
    await assertProjectWrite(session.user.id, params.id);

    const projectId = params.id;
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