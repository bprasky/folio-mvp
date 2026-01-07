import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertProjectView } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

/**
 * DELETE /api/projects/[id]/force-delete
 * Force delete an archived project (bypasses the 30-day waiting period)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check project access
    await assertProjectView(session.user.id, projectId);

    // Verify user is owner or designer
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, designerId: true, archivedAt: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const isOwner = project.ownerId === session.user.id || project.designerId === session.user.id;
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: Only project owner can force delete' },
        { status: 403 }
      );
    }

    // Check if project is archived
    if (!project.archivedAt) {
      return NextResponse.json(
        { error: 'Project is not archived. Use regular delete endpoint instead.' },
        { status: 400 }
      );
    }

    // Force delete the project
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ 
      message: 'Project permanently deleted',
      deleted: true 
    });
  } catch (error: any) {
    console.error('Error force deleting project:', error);
    if (error.message === "Forbidden") {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to force delete project' },
      { status: 500 }
    );
  }
}



