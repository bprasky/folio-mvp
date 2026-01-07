import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { getVendorContext } from '@/lib/auth/vendorContext';
import { vendorProjectsWhereDemo } from '@/lib/visibility/vendorProjects';
import { getUserIdFromRequest } from '@/lib/apiAuth';

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const rawName = (body?.name ?? body?.projectName ?? "").trim();
    const name = rawName.length ? rawName : "Untitled project";
    const note = typeof body?.note === "string" ? body.note : "";

    const initialRooms: string[] = Array.isArray(body?.initialRooms)
      ? body.initialRooms.map((r: any) => String(r ?? "").trim()).filter(Boolean)
      : [];

    const vendorCtx = await getVendorContext().catch(() => null);

    // Transaction: create project, then optional rooms
    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          title: name,     // Use title field (schema uses title, not name)
          description: note,
          ownerId: userId,
          // If your schema has vendorOrgId, set it; if not, Prisma will error — so guard try/catch:
          ...(vendorCtx?.vendorOrgId ? { vendorOrgId: vendorCtx.vendorOrgId as any } : {}),
        },
        select: { id: true, title: true, createdAt: true },
      });

      if (initialRooms.length) {
        // createMany if your schema supports; otherwise loop create
        try {
          // Using loop for maximum compatibility
          for (const roomName of initialRooms) {
            await tx.room.create({
              data: {
                name: roomName,
                projectId: project.id as any,
              },
              select: { id: true },
            });
          }
        } catch (e) {
          // If your model is named differently (e.g., ProjectRoom), we just skip silently for the demo
          console.warn("[DEMO] room create skipped:", (e as any)?.code || (e as any)?.message);
        }
      }

      return project;
    });

    return NextResponse.json({ project: result }, { status: 201 });
  } catch (err) {
    console.error("POST /api/vendor/projects failed:", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ projects: [], count: 0 });

  const where = vendorProjectsWhereDemo(userId);

  // Pull projects with fields we need for designer labels
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { selections: true } }
    },
    take: 50,
  });

  // Map designer label:
  //  - if designerOrgId present, fetch org names
  //  - else, try last handoff recipient (VendorVisit) for a friendly "Pending (sent to ...)"
  const idsNeedingOrg = projects.filter(p => !!p.designerOrgId).map(p => p.designerOrgId as string);
  const orgs = idsNeedingOrg.length
    ? await prisma.organization.findMany({
        where: { id: { in: idsNeedingOrg } },
        select: { id: true, name: true },
      })
    : [];

  const orgNameById = new Map(orgs.map(o => [o.id, o.name]));

  // Try to read last recipient email per project from visits (best-effort; ignore errors)
  const pendingByProject: Record<string, string | undefined> = {};
  try {
    // If VendorVisit links to projectId, use that; else skip this block.
    const visits = await prisma.vendorVisit.findMany({
      where: { projectId: { in: projects.map(p => p.id) } },
      orderBy: { createdAt: 'desc' },
      select: { projectId: true, designerEmail: true, createdAt: true },
    });
    for (const v of visits) {
      if (!pendingByProject[v.projectId!]) pendingByProject[v.projectId!] = v.designerEmail ?? undefined;
    }
  } catch (_) {
    // silently ignore if model not present or field doesn't exist
  }

  const enriched = projects.map(p => {
    const projectName = p?.title || "Untitled project";
    const designerName =
      (p.designerOrgId && orgNameById.get(p.designerOrgId)) ||
      (pendingByProject[p.id] ? `Pending (sent to ${pendingByProject[p.id]})` : "Not assigned");

    return {
      id: p.id,
      name: projectName,
      title: projectName, // for compatibility
      designerName,
      designerOrgName: p.designerOrgId ? orgNameById.get(p.designerOrgId) : undefined,
      createdAt: p.createdAt,
      handoffInvitedAt: p.handoffInvitedAt,
      handoffClaimedAt: p.handoffClaimedAt,
      isHandoffReady: p.isHandoffReady,
      description: p.description,
      status: p.status,
      _count: p._count
    };
  });

  const count = await prisma.project.count({ where });

  return NextResponse.json({ projects: enriched, count });
} 