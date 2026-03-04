export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string }}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      where: { id: params.id },
      select: { id: true, title: true, handoffClaimedAt: true, ownerId: true, vendorOrgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isVendorOrg = orgUser && project.vendorOrgId === orgUser.organizationId;
    if (!isOwner && !isVendorOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const visits = await prisma.vendorVisit.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, token: true, createdAt: true, designerEmail: true, projectId: true },
    });

    const items = visits.map(v => ({
      id: v.id,
      token: v.token,
      createdAt: v.createdAt,
      designerEmail: v.designerEmail,
      project: { id: project.id, title: project.title, handoffClaimedAt: project.handoffClaimedAt },
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[Visits GET] failed:', (error as any)?.message);
    return NextResponse.json({ error: 'Failed to fetch visits' }, { status: 500 });
  }
}
