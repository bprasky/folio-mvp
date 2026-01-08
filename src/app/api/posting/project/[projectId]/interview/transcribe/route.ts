export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { assertProjectView } from "@/lib/authz/access";
import { normalizeRole } from "@/lib/permissions";
import OpenAI from "openai";
import { z } from "zod";

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";
const OPENAI_ENABLED =
  !!process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED !== "false";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    if (!POSTING_V1_ENABLED) {
      return NextResponse.json(
        { error: "posting_disabled" },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;
    const role = normalizeRole(session?.user?.role);

    // Check project access
    await assertProjectView(session.user.id, projectId);

    // Verify role permission
    const { prisma } = await import("@/lib/prisma");
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, designerId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const isOwner = project.ownerId === session.user.id || project.designerId === session.user.id;
    if (!isOwner && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If OpenAI not available, return error
    if (!OPENAI_ENABLED) {
      return NextResponse.json(
        { error: "transcription_unavailable", message: "OpenAI Whisper is not configured" },
        { status: 503 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const questionId = formData.get("questionId") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "invalid_body", message: "Audio file is required" },
        { status: 422 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "file_too_large", message: `Audio file exceeds ${MAX_AUDIO_SIZE / 1024 / 1024}MB limit` },
        { status: 422 }
      );
    }

    // Validate file type (audio files)
    const allowedTypes = ["audio/webm", "audio/ogg", "audio/wav", "audio/mp3", "audio/mpeg", "audio/m4a"];
    if (!allowedTypes.includes(audioFile.type) && !audioFile.name.match(/\.(webm|ogg|wav|mp3|m4a)$/i)) {
      return NextResponse.json(
        { error: "invalid_file_type", message: "Audio file must be webm, ogg, wav, mp3, or m4a" },
        { status: 422 }
      );
    }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Convert File to format expected by OpenAI
      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const file = new File([buffer], audioFile.name, { type: audioFile.type });

      // Transcribe with Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "en", // Optional: specify language for better accuracy
      });

      const transcript = transcription.text?.trim() || "";

      if (!transcript) {
        return NextResponse.json(
          { error: "transcription_empty", message: "No transcript generated from audio" },
          { status: 422 }
        );
      }

      // Analytics (non-blocking)
      import("@/lib/analytics")
        .then(({ logPassiveEvent }) => {
          return logPassiveEvent({
            type: "save" as any,
            projectId,
            actorId: session.user.id,
            payload: {
              event: "interview_voice_transcribed",
              questionId: questionId || undefined,
              transcriptLength: transcript.length,
            },
          });
        })
        .catch((analyticsError) => {
          console.warn("Analytics logging failed (non-blocking):", analyticsError);
        });

      return NextResponse.json(
        { ok: true, transcript, questionId: questionId || undefined },
        { status: 200 }
      );
    } catch (transcriptionError: any) {
      console.error("[interview/transcribe] Transcription error:", transcriptionError);
      
      // Handle OpenAI-specific errors
      if (transcriptionError?.status === 401) {
        return NextResponse.json(
          { error: "auth_failed", message: "OpenAI API key is invalid" },
          { status: 401 }
        );
      }
      if (transcriptionError?.status === 429) {
        return NextResponse.json(
          { error: "rate_limited", message: "OpenAI rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "transcription_failed", message: transcriptionError?.message || "Transcription failed" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[interview/transcribe] Error:", error);
    return NextResponse.json(
      { error: "server_error", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}


