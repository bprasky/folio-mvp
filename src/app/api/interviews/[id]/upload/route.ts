export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = process.env.SB_BUCKET_NAME || "event-images";

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

    // Get file from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (audio only for v1)
    if (!file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "File must be an audio file" }, { status: 400 });
    }

    // Determine file extension
    const ext = file.name.split(".").pop() || (file.type.includes("mpeg") ? "mp3" : "wav");
    const storageKey = `interviews/${interviewId}/recording.${ext}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storageKey, buffer, {
        contentType: file.type,
        upsert: true, // Allow overwriting if re-uploading
      });

    if (uploadError) {
      console.error("[interviews/upload] Upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file", details: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storageKey);

    // Create or update MediaAsset
    let mediaAsset;
    if (interviewSession.recordingAssetId) {
      mediaAsset = await prisma.mediaAsset.update({
        where: { id: interviewSession.recordingAssetId },
        data: {
          storageKey,
          url: publicUrlData.publicUrl,
          mimeType: file.type,
          fileSizeBytes: file.size,
        },
      });
    } else {
      mediaAsset = await prisma.mediaAsset.create({
        data: {
          storageKey,
          url: publicUrlData.publicUrl,
          mimeType: file.type,
          fileSizeBytes: file.size,
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
      mediaAsset: {
        id: mediaAsset.id,
        url: mediaAsset.url,
        storageKey: mediaAsset.storageKey,
      },
    });
  } catch (error) {
    console.error("[interviews/upload] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




