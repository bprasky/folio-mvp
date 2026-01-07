// POST /api/vendor/visits
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { track, VendorAnalytics } from "@/lib/analytics";
import { canVendorCreateHandoff } from "@/lib/permissions";
import { getUserIdFromRequest } from "@/lib/apiAuth";
import { getVendorContext } from "@/lib/auth/vendorContext";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      designerEmail, 
      products = [], 
      quote, 
      note, 
      expiresAt, 
      sendEmail = false 
    } = body;

    // Check if this is the new handoff flow
    if (designerEmail && products.length > 0) {
      // New handoff flow
      if (!canVendorCreateHandoff(session.user)) {
        return NextResponse.json({ error: "Vendor role required" }, { status: 403 });
      }

      // Create VendorVisit with token
      const visit = await prisma.vendorVisit.create({
        data: {
          vendorId: session.user.id,
          designerEmail,
          note: note || null,
          token: nanoid(32),
          ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        },
      });

      // Create quote attachment if provided
      let quoteAttachmentId = null;
      if (quote) {
        const quoteAttachment = await prisma.quoteAttachment.create({
          data: {
            vendorId: session.user.id,
            projectId: null, // Will be set when designer chooses destination
            fileUrl: quote.fileUrl || null,
            fileName: quote.fileName || null,
            totalCents: quote.totalCents || null,
            currency: quote.currency || 'USD',
            leadTimeDays: quote.leadTimeDays || null,
            termsShort: quote.termsShort || null,
            expiresAt: quote.expiresAt ? new Date(quote.expiresAt) : null,
            jsonPayload: quote.jsonPayload || null,
            status: 'DRAFT',
          },
        });
        quoteAttachmentId = quoteAttachment.id;
      }

      // Create HandoffPackage
      await prisma.handoffPackage.create({
        data: {
          visitId: visit.id,
          vendorId: session.user.id,
          designerEmail,
          itemsJson: products,
          quoteAttachmentId,
        },
      });

      // Track the event
      await track(session.user, 'vendor.handoff.created', {
        visitId: visit.id,
        designerEmail,
        itemsCount: products.length,
        hasQuote: !!quote,
      });

      // TODO: Send email if sendEmail is true
      if (sendEmail) {
        await track(session.user, 'visit.email.sent', {
          visitId: visit.id,
          designerEmail,
        });
      }

      return NextResponse.json({ 
        visit: { 
          id: visit.id, 
          token: visit.token 
        } 
      });
    } else {
      // Legacy visit flow
      const { projectId, designerId } = body ?? {};

      const visit = await prisma.vendorVisit.create({
        data: {
          vendorId: session.user.id,
          designerEmail: designerId || '', // Map legacy designerId to designerEmail
          projectId: projectId ?? null,
          note: note ?? null,
          token: nanoid(32),
          ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        },
      });

      await VendorAnalytics.visitCreated(session.user.id, visit.id);
      return NextResponse.json({ visit });
    }
  } catch (error) {
    console.error("Error creating visit:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    const userId = (t?.sub as string) || (t as any)?.id || null;
    if (!userId) return NextResponse.json({ items: [] });

    const u = new URL(req.url);
    const takeParam = parseInt(u.searchParams.get("limit") || "5", 10);
    const take = Number.isFinite(takeParam) && takeParam > 0 && takeParam <= 50 ? takeParam : 5;

    const visits = await prisma.vendorVisit.findMany({
      where: { vendorId: userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, token: true, createdAt: true, designerEmail: true, projectId: true },
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
      designerEmail: v.designerEmail,
      project: v.projectId ? pmap.get(v.projectId) : undefined,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
