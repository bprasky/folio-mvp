import { deleteProjectWithSpotlightGuard } from '@/lib/spotlight/deletion';
import { SpotlightConflict } from '@/lib/spotlight/gate';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertProjectDelete } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    // Delete capability: Owner/Admin of the org (or non-org project
    // creator, or global admin). Matrix in src/lib/orgPermissions.ts.
    try {
      await assertProjectDelete(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this project' }, { status: 403 });
    }

    // Check if project is archived
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { archivedAt: true },
    });

    if (!project?.archivedAt) {
      return NextResponse.json(
        { error: 'Project is not archived. Use regular delete endpoint instead.' },
        { status: 400 }
      );
    }

    // Force delete the project
    await deleteProjectWithSpotlightGuard(projectId);

    return NextResponse.json({ 
      message: 'Project permanently deleted',
      deleted: true 
    });
  } catch (error: any) {
    if (error instanceof SpotlightConflict) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
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



