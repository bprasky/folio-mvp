export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertProjectView, assertProjectWrite, assertProjectDelete } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

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

    // Most of Project's children cascade on delete, but seven optional
    // relations (Story, Order, Media, Recognition, Collaboration,
    // Contribution, PendingRepInvite) are declared without `onDelete` in the
    // schema. Their projectId is nullable, so a stray row in any of them
    // raises a foreign-key violation and the delete fails with "failed to
    // delete". Unlink them first — these are optional associations, so
    // nulling the link (SetNull semantics) preserves the records while
    // letting the project go. Wrapped in a transaction so the unlink and the
    // delete succeed or fail together.
    await prisma.$transaction([
      prisma.story.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.order.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.media.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.recognition.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.collaboration.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.contribution.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.pendingRepInvite.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

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