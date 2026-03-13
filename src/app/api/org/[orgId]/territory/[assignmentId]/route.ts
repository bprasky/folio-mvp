export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/org/[orgId]/territory/[assignmentId]
 * Admin removes a territory assignment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; assignmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, assignmentId } = await params;

    // Verify caller is admin/owner
    const adminMembership = await prisma.organizationUser.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!adminMembership) {
      return NextResponse.json({ error: 'Only org admins can remove territory assignments' }, { status: 403 });
    }

    // Verify assignment belongs to this org
    const assignment = await prisma.orgTerritoryAssignment.findFirst({
      where: {
        id: assignmentId,
        vendorOrgId: orgId,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await prisma.orgTerritoryAssignment.delete({
      where: { id: assignmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[territory/assignmentId] DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
