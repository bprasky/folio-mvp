import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { track, VendorAnalytics } from "@/lib/analytics";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

type Params = { params: { token: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    const visit = await prisma.vendorVisit.findUnique({ 
      where: { token: params.token },
      include: {
        handoffPackage: {
          include: {
            quoteAttachment: true,
          },
        },
      },
    });
    
    if (!visit) {
      return new Response('Not found', { status: 404 });
    }
    
    if (visit.expiresAt && visit.expiresAt < new Date()) {
      return new Response('Expired', { status: 410 });
    }

    // Track visit opening with deduplication
    if (session?.user) {
      await track(session.user, 'designer.handoff.opened', { visitId: visit.id });
    }

    // Check if this is a handoff package
    if (visit.handoffPackage) {
      // New handoff flow
      const handoff = visit.handoffPackage;
      const items = handoff.itemsJson as any[] || [];
      const quote = handoff.quoteAttachment;

      return NextResponse.json({
        visit: {
          id: visit.id,
          vendorId: visit.vendorId,
          designerEmail: visit.designerEmail,
          createdAt: visit.createdAt,
          note: visit.note,
        },
        handoff: {
          items,
          hasQuote: !!quote,
          quote: quote ? {
            id: quote.id,
            status: quote.status,
            fileUrl: quote.fileUrl,
            fileName: quote.fileName,
            totalCents: quote.totalCents,
            currency: quote.currency,
            leadTimeDays: quote.leadTimeDays,
            termsShort: quote.termsShort,
            expiresAt: quote.expiresAt,
            version: quote.version,
          } : null,
        },
        designerMustLogin: !session,
      });
    } else {
      // Legacy visit flow
      return NextResponse.json({
        visit: {
          id: visit.id,
          projectId: visit.projectId,
          designerEmail: visit.designerEmail,
          note: visit.note,
          createdAt: visit.createdAt,
        },
      });
    }
  } catch (error) {
    console.error('Error resolving visit token:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
