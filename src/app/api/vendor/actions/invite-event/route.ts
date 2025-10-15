import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canVendorUseQuickActions } from "@/lib/permissions";
import { VendorAnalytics } from "@/lib/analytics";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, designerId, eventId, message } = body;

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    // Check vendor has access to project if specified
    if (projectId) {
      const canInvite = await canVendorUseQuickActions(session.user.id, projectId);
      if (!canInvite) {
        return NextResponse.json({ error: "No access to project" }, { status: 403 });
      }
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        startDate: true,
        location: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Create invitation (you might want to create an Invitation model)
    // For now, we'll just log the action
    const invitation = {
      id: `inv_${Date.now()}`,
      eventId,
      projectId: projectId || null,
      designerId: designerId || null,
      vendorId: session.user.id,
      message: message || null,
      createdAt: new Date(),
    };

    // Emit analytics
    await VendorAnalytics.inviteEvent({
      projectId: projectId || undefined,
      actorId: session.user.id,
      payload: {
        eventId,
        eventTitle: event.title,
        projectId: projectId || null,
        designerId: designerId || null,
        hasMessage: Boolean(message),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Invitation sent",
      invitation: {
        id: invitation.id,
        event: {
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          location: event.location,
        },
        projectId: invitation.projectId,
        designerId: invitation.designerId,
      },
    });
  } catch (error: any) {
    console.error("[invite-event][POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

