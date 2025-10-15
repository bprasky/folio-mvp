import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canVendorAttachQuote, canDesignerSeeVendorQuote } from "@/lib/permissions";
import { VendorAnalytics } from "@/lib/analytics";
import { assertProjectView } from "@/lib/authz/access";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = params;
    const access = await assertProjectView(session.user.id, projectId);
    const formData = await request.formData();

    // Check vendor permissions
    const canAttach = await canVendorAttachQuote(session.user.id, projectId);
    if (!canAttach) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse form data
    const roomId = formData.get('roomId') as string | null;
    const selectionId = formData.get('selectionId') as string | null;
    const totalCents = formData.get('totalCents') ? parseInt(formData.get('totalCents') as string) : null;
    const currency = (formData.get('currency') as string) || 'USD';
    const leadTimeDays = formData.get('leadTimeDays') ? parseInt(formData.get('leadTimeDays') as string) : null;
    const termsShort = formData.get('termsShort') as string | null;
    const expiresAt = formData.get('expiresAt') ? new Date(formData.get('expiresAt') as string) : null;
    const supersedesId = formData.get('supersedesId') as string | null;
    const jsonPayload = formData.get('jsonPayload') ? JSON.parse(formData.get('jsonPayload') as string) : null;

    // Handle file upload
    const file = formData.get('file') as File | null;
    let fileUrl = null;
    let fileName = null;

    if (file) {
      // Upload to Supabase storage
      const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
      const bucket = process.env.SB_BUCKET_NAME || "event-images";
      
      const fileExt = file.name.split('.').pop();
      const storedFileName = `quote-${Date.now()}.${fileExt}`;
      const filePath = `quotes/${projectId}/${storedFileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(filePath, file);

      if (error) {
        return NextResponse.json({ error: "File upload failed" }, { status: 500 });
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(filePath);

      fileUrl = publicUrl;
      fileName = file.name;
    }

    // Get version number
    let version = 1;
    if (supersedesId) {
      const supersededQuote = await prisma.quoteAttachment.findUnique({
        where: { id: supersedesId },
        select: { version: true },
      });
      if (supersededQuote) {
        version = supersededQuote.version + 1;
      }
    }

    // Create quote
    const quote = await prisma.quoteAttachment.create({
      data: {
        vendorId: session.user.id,
        projectId,
        roomId,
        selectionId,
        fileUrl,
        fileName,
        totalCents,
        currency,
        leadTimeDays,
        termsShort,
        version,
        supersedesId,
        expiresAt,
        jsonPayload,
      },
    });

    // Emit analytics
    await VendorAnalytics.quoteCreated({
      projectId,
      actorId: session.user.id,
      payload: {
        quoteId: quote.id,
        version,
        hasFile: Boolean(fileUrl),
        hasStructured: Boolean(totalCents || jsonPayload),
        supersedesId,
      },
    });

    return NextResponse.json({
      ok: true,
      quote: {
        id: quote.id,
        version: quote.version,
        fileUrl: quote.fileUrl,
        fileName: quote.fileName,
        totalCents: quote.totalCents,
        currency: quote.currency,
        leadTimeDays: quote.leadTimeDays,
        termsShort: quote.termsShort,
        status: quote.status,
        expiresAt: quote.expiresAt,
        createdAt: quote.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[quotes][POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = params;
    const access = await assertProjectView(session.user.id, projectId);

    // Check permissions
    const canSee = await canDesignerSeeVendorQuote(session.user.id, projectId);
    if (!canSee) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all quotes for project (both legacy and new)
    const quotes = await prisma.quoteAttachment.findMany({
      where: { projectId },
      orderBy: [
        { version: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        vendorId: true,
        roomId: true,
        selectionId: true,
        fileUrl: true,
        fileName: true,
        totalCents: true,
        currency: true,
        leadTimeDays: true,
        termsShort: true,
        version: true,
        supersedesId: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        supersedes: {
          select: {
            id: true,
            version: true,
          },
        },
      },
    });

    // Group by version chains
    const quoteChains = quotes.reduce((acc, quote) => {
      const key = quote.supersedesId || quote.id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(quote);
      return acc;
    }, {} as Record<string, typeof quotes>);

    // Sort chains by most recent
    const sortedChains = Object.values(quoteChains).sort((a, b) => 
      new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime()
    );

    return NextResponse.json({
      ok: true,
      quotes: sortedChains,
    });
  } catch (error: any) {
    console.error("[quotes][GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
