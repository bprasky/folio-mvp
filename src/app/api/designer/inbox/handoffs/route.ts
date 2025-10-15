import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";

export async function GET(req: Request) {
  const s = await getServerSession().catch(() => null);
  let email = s?.user?.email?.toLowerCase() ?? null;
  if (!email) {
    try {
      const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
      email = (t as any)?.email?.toLowerCase?.() ?? null;
    } catch {}
  }
  if (!email) return NextResponse.json({ items: [] });

  try {
    const visits = await prisma.vendorVisit.findMany({
      where: { designerEmail: email },
      orderBy: { createdAt: "desc" },
      select: { id: true, token: true, createdAt: true, projectId: true },
    });

    const projectIds = Array.from(
      new Set(visits.map(v => v.projectId).filter(Boolean) as string[])
    );

    const projects = projectIds.length
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, title: true, handoffClaimedAt: true },
        })
      : [];

    const pmap = new Map(projects.map(p => [p.id, p]));

    const items = visits.map(v => ({
      id: v.id,
      token: v.token,
      createdAt: v.createdAt,
      project: v.projectId ? pmap.get(v.projectId) : undefined,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
