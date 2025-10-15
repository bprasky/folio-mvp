import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string }}) {
  try {
    const visits = await prisma.vendorVisit.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, token: true, createdAt: true, designerEmail: true, projectId: true },
    });

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, handoffClaimedAt: true },
    });

    const items = visits.map(v => ({
      id: v.id,
      token: v.token,
      createdAt: v.createdAt,
      designerEmail: v.designerEmail,
      project: project ?? undefined,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
