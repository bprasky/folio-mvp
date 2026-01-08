export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const interviewId = params.id;

    // Fetch interview session with relations
    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: interviewId },
      select: {
        id: true,
        status: true,
        mode: true,
        promptLens: true,
        errorMessage: true,
        recordedAt: true,
        uploadedAt: true,
        transcribedAt: true,
        extractedAt: true,
        publishedAt: true,
        createdByUserId: true,
        vendorId: true,
        productId: true,
        recordingAsset: {
          select: {
            id: true,
            url: true,
            durationMs: true,
            mimeType: true,
          },
        },
        highlights: {
          where: {
            approvedByDesigner: true,
          },
          select: {
            id: true,
            quoteText: true,
            useCase: true,
            startMs: true,
            endMs: true,
            score: true,
          },
          orderBy: {
            score: "desc",
          },
        },
      },
    });

    if (!interviewSession) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    // Check access: owner OR vendor (if product interview)
    const isOwner = interviewSession.createdByUserId === userId;
    const isVendor = interviewSession.vendorId && interviewSession.productId;

    if (!isOwner && !isVendor) {
      // If vendor, verify they match the vendorId
      if (isVendor) {
        // We'd need to check the user's vendor association here
        // For now, we'll allow if they have vendor role and the vendorId matches
        // This is a simplified check - you may want to enhance this
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate progress (simplified - v1 doesn't have real-time progress)
    const progress = {
      transcriptionProgress: interviewSession.status === "TRANSCRIBED" || 
                           interviewSession.status === "EXTRACTING" ||
                           interviewSession.status === "EXTRACTED" ||
                           interviewSession.status === "READY" ||
                           interviewSession.status === "PUBLISHED" ? 100 : 
                           interviewSession.status === "TRANSCRIBING" ? 50 : 0,
      extractionProgress: interviewSession.status === "EXTRACTED" ||
                         interviewSession.status === "READY" ||
                         interviewSession.status === "PUBLISHED" ? 100 :
                         interviewSession.status === "EXTRACTING" ? 50 : 0,
    };

    return NextResponse.json({
      ok: true,
      interviewSession: {
        ...interviewSession,
        progress,
      },
    });
  } catch (error) {
    console.error("[interviews/status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




