import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { z } from "zod";

const BUCKET = process.env.SB_BUCKET_NAME || "event-images";

const ConfirmUploadSchema = z.object({
  storageKey: z.string(),
  url: z.string().url(),
  durationMs: z.number().positive().optional(),
  fileSizeBytes: z.number().positive(),
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

    const body = await request.json();
    const parsed = ConfirmUploadSchema.parse(body);

    // Verify file exists in storage
    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(parsed.storageKey.split("/").slice(0, -1).join("/"), {
        limit: 1,
        search: parsed.storageKey.split("/").pop(),
      });

    if (fileError || !fileData || fileData.length === 0) {
      console.error("[interviews/confirm-upload] File not found in storage:", fileError);
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      );
    }

    // Create or update MediaAsset
    let mediaAsset;
    if (interviewSession.recordingAssetId) {
      mediaAsset = await prisma.mediaAsset.update({
        where: { id: interviewSession.recordingAssetId },
        data: {
          storageKey: parsed.storageKey,
          url: parsed.url,
          durationMs: parsed.durationMs || null,
          fileSizeBytes: parsed.fileSizeBytes,
        },
      });
    } else {
      // Determine mime type from URL or file extension
      const mimeType = parsed.url.includes("mp3") || parsed.storageKey.endsWith(".mp3")
        ? "audio/mpeg"
        : parsed.url.includes("wav") || parsed.storageKey.endsWith(".wav")
        ? "audio/wav"
        : "audio/mpeg"; // default

      mediaAsset = await prisma.mediaAsset.create({
        data: {
          storageKey: parsed.storageKey,
          url: parsed.url,
          mimeType,
          durationMs: parsed.durationMs || null,
          fileSizeBytes: parsed.fileSizeBytes,
        },
      });
    }

    // Update interview session
    const updated = await prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        recordingAssetId: mediaAsset.id,
        status: "UPLOADED",
        uploadedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        recordingAssetId: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      interviewSession: updated,
    });
  } catch (error) {
    console.error("[interviews/confirm-upload] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

