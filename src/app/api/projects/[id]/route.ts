export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertProjectView, assertProjectWrite, assertProjectDelete } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await assertProjectView(session.user.id, projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        vendorOrg: true,
        designerOrg: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        designer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        rooms: {
          include: {
            selections: true,
          },
        },
        selections: {
          include: {
            room: true,
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

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete capability is Owner/Admin only (or non-org project creator).
    // See src/lib/orgPermissions.ts for the matrix.
    await assertProjectDelete(session.user.id, projectId);

    // Every foreign key that references a project is declared ON DELETE
    // CASCADE or SET NULL, so a straight delete is sufficient — Postgres
    // tears down or detaches the children. (If a real FK ever blocks this,
    // the error below names the constraint; fix that constraint's onDelete
    // in a migration rather than unlinking by hand here.)
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ message: 'Project deleted successfully', deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting project:', error);
    if (message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json(
        { error: 'You do not have permission to delete this project' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete project: ' + message },
      { status: 500 }
    );
  }
} 