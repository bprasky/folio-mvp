import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDesignerClaimVisit } from "@/lib/permissions";
import { track } from "@/lib/analytics";
import { createProjectParticipant } from "@/lib/authz/access";

type Params = { params: { token: string } };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { choice, projectId, newTitle } = await req.json();

    // Resolve token → VendorVisit
    const visit = await prisma.vendorVisit.findUnique({
      where: { token: params.token },
      include: {
        handoffPackage: true,
      },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    }

    // Check if expired
    if (visit.expiresAt && visit.expiresAt < new Date()) {
      return NextResponse.json({ error: "Visit expired" }, { status: 410 });
    }

    // Ensure designer can claim this visit
    if (!canDesignerClaimVisit(session.user, visit)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let chosenProjectId: string;

    if (choice === 'existing') {
      if (!projectId) {
        return NextResponse.json({ error: "Project ID required for existing choice" }, { status: 400 });
      }
      chosenProjectId = projectId;
    } else if (choice === 'new') {
      // Create minimal project for this designer
      const name = String(body?.newProjectName || visit.project?.title || "Imported Handoff").trim();
      const project = await prisma.project.create({
        data: {
          title: name,   // Use title field (schema uses title, not name)
          ownerId: session.user.id,
          designerId: session.user.id,
        },
      });
      chosenProjectId = project.id;
    } else if (choice === 'specsheet') {
      // Create special minimal project flagged as spec sheet
      const name = `Spec Sheet – ${new Date().toLocaleDateString()}`;
      const project = await prisma.project.create({
        data: {
          title: name,   // Use title field (schema uses title, not name)
          ownerId: session.user.id,
          designerId: session.user.id,
          // Add a flag to indicate this is a spec sheet if your schema supports it
        },
      });
      chosenProjectId = project.id;
    } else {
      return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
    }

    // Create ProjectParticipant entries for proper access control
    // Designer is the owner
    await createProjectParticipant(
      chosenProjectId,
      null, // orgId - null for direct user participation
      session.user.id, // userId
      "DESIGNER", // side
      "OWNER" // role
    );

    // Vendor org gets editor access
    await createProjectParticipant(
      chosenProjectId,
      visit.vendorId, // orgId - vendor organization
      null, // userId - null for org-level participation
      "VENDOR", // side
      "EDITOR" // role
    );

    // Attach every handoff item as Selection records on that project
    const items = visit.handoffPackage?.itemsJson as any[] || [];
    let attachedCount = 0;

    for (const item of items) {
      await prisma.selection.create({
        data: {
          projectId: chosenProjectId,
          productName: item.sku || item.productName || 'Unknown Product',
          vendorName: 'Vendor', // You might want to fetch the actual vendor name
          colorFinish: item.finish || '',
          quantity: item.quantity || 1,
          notes: item.note || '',
          photo: item.imageUrl || null,
          vendorRepId: visit.vendorId,
          vendorOrgId: visit.vendorId, // Ensure vendor attribution
        },
      });
      attachedCount++;
    }

    // If quoteAttachmentId exists → update that QuoteAttachment with projectId
    if (visit.handoffPackage?.quoteAttachmentId) {
      await prisma.quoteAttachment.update({
        where: { id: visit.handoffPackage.quoteAttachmentId },
        data: { 
          projectId: chosenProjectId,
          status: 'SENT',
        },
      });
    }

    // Update VendorVisit.projectId
    await prisma.vendorVisit.update({
      where: { id: visit.id },
      data: { projectId: chosenProjectId },
    });

    // ✅ Stamp the originating vendor project with a claim time
    try {
      if (visit?.project?.id) {
        await prisma.project.update({
          where: { id: visit.project.id as any },
          data: { handoffClaimedAt: new Date() },
        });
      }
    } catch (e) {
      console.warn("[Claim] could not stamp handoffClaimedAt:", (e as any)?.message);
    }

    // Track the event
    await track(session.user, 'designer.handoff.destination_selected', {
      visitId: visit.id,
      choice,
      projectId: chosenProjectId,
      attachedCount,
    });

    return NextResponse.json({ 
      ok: true, targetProjectId: chosenProjectId, 
      attachedCount 
    });
  } catch (error) {
    console.error("Error choosing destination:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

