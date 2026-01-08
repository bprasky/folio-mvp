export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { z } from "zod";

const BUCKET = process.env.SB_BUCKET_NAME || "event-images";

const UploadUrlSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().positive(),
  mimeType: z.string(),
});

export async function POST(
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

    // Verify interview session exists and user owns it
    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: interviewId },
      select: { createdByUserId: true, status: true },
    });

    if (!interviewSession) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    if (interviewSession.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden: not interview owner" }, { status: 403 });
    }

    if (interviewSession.status !== "DRAFT" && interviewSession.status !== "UPLOADED") {
      return NextResponse.json(
        { error: `Cannot upload: interview is in ${interviewSession.status} status` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = UploadUrlSchema.parse(body);

    // Determine file extension from mime type or fileName
    const ext = parsed.fileName.split(".").pop() || (parsed.mimeType.includes("mpeg") ? "mp3" : "wav");
    const storageKey = `interviews/${interviewId}/recording.${ext}`;

    // For v1, we'll use Supabase's signed URL for PUT operations
    // Create a signed URL that allows PUT to the storage path
    // Note: Supabase storage REST API supports signed URLs via JWT tokens
    // We'll generate a signed URL using the storage API
    
    // Get public URL for reference
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storageKey);

    // For v1, return the storage path and endpoint
    // Client will upload to: POST /api/interviews/[id]/upload (we'll create this)
    // Or we can use the storage REST API with a signed token
    // For simplicity, we'll create a direct upload endpoint
    
    return NextResponse.json({
      ok: true,
      // Return the upload endpoint (client will POST file to this)
      uploadEndpoint: `/api/interviews/${interviewId}/upload`,
      storageKey,
      publicUrl: publicUrlData.publicUrl,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    console.error("[interviews/upload-url] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

