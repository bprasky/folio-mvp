import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canVendorAttachQuote, canDesignerSeeVendorQuote } from "@/lib/permissions";
import { VendorAnalytics } from "@/lib/analytics";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId, quoteId } = params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Find quote and check ownership
    const quote = await prisma.quoteAttachment.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        vendorId: true,
        projectId: true,
        status: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Check permissions - vendor can update their own quotes, designer can update accepted/rejected
    const isVendor = quote.vendorId === session.user.id;
    const canUpdate = isVendor || 
      (['ACCEPTED', 'REJECTED'].includes(status) && await canDesignerSeeVendorQuote(session.user.id, projectId));

    if (!canUpdate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update status
    const updatedQuote = await prisma.quoteAttachment.update({
      where: { id: quoteId },
      data: { status },
      select: {
        id: true,
        version: true,
        status: true,
        vendorId: true,
      },
    });

    // Emit analytics
    await VendorAnalytics.quoteStatusChanged({
      projectId,
      actorId: session.user.id,
      payload: {
        quoteId: quote.id,
        version: updatedQuote.version,
        oldStatus: quote.status,
        newStatus: status,
        changedByVendor: isVendor,
      },
    });

    return NextResponse.json({
      ok: true,
      quote: {
        id: updatedQuote.id,
        version: updatedQuote.version,
        status: updatedQuote.status,
      },
    });
  } catch (error: any) {
    console.error("[quote-status][PATCH]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

