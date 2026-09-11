import { legacyInterviewBoundary } from '@/lib/spotlight/legacyBoundary';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { assertProjectWrite } from "@/lib/authz/access";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import OpenAI from "openai";
import { z } from "zod";

// Matches the bucket the other interview upload path uses
// (src/app/api/interviews/[id]/upload/route.ts).
const BUCKET = process.env.SB_BUCKET_NAME || "event-images";

/** One spoken answer's retained recording and word-level timings. */
type AnswerAudio = {
  audioUrl: string;
  /** Whisper word timings, seconds. First-word start to last-word end resolves
   *  any contiguous substring — which is what a pull quote is — to a span. */
  words: Array<{ word: string; start: number; end: number }>;
  capturedAt: string;
};

function extensionFor(file: File): string {
  const fromName = file.name.match(/\.(webm|ogg|wav|mp3|m4a)$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (file.type.includes("ogg")) return "ogg";
  if (file.type.includes("wav")) return "wav";
  if (file.type.includes("mpeg") || file.type.includes("mp3")) return "mp3";
  if (file.type.includes("m4a")) return "m4a";
  return "webm";
}

/**
 * Persist the recording and its timings.
 *
 * Written to `provenance.interview.audio`, keyed by questionId — a SIBLING of
 * `provenance.interview.payload`, deliberately. The answer row does not exist
 * yet at transcription time (the client saves it in a later request), and
 * `EditorialInterviewAnswer` is a wipe-and-rebuild projection that would drop a
 * directly-written audioUrl on the designer's next save. Keying by question
 * rather than by answer revision means re-answering never orphans the audio,
 * and the interview save preserves this key because it spreads
 * `existingProvenance.interview` (interview/route.ts, nextProvenance).
 *
 * Never throws. Losing the recording must not cost the designer their answer.
 */
async function retainAudio(
  projectId: string,
  questionId: string,
  file: File,
  buffer: Buffer,
  words: AnswerAudio["words"],
): Promise<string | null> {
  try {
    const storageKey = `interviews/${projectId}/answers/${questionId}.${extensionFor(file)}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storageKey, buffer, {
        contentType: file.type || "audio/webm",
        // Re-recording an answer replaces its audio, as it replaces its text.
        upsert: true,
      });

    if (uploadError) {
      console.error("[interview/transcribe] Audio upload failed:", uploadError);
      return null;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storageKey);
    const audioUrl = publicUrlData?.publicUrl;
    if (!audioUrl) return null;

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: { provenance: true },
    });

    // No post yet means the interview has never been saved. The blob is already
    // in storage under a deterministic key, so the reference can be recovered.
    if (!post) return audioUrl;

    const provenance = (post.provenance as any) || {};
    const interview = provenance.interview || {};
    const entry: AnswerAudio = {
      audioUrl,
      words,
      capturedAt: new Date().toISOString(),
    };

    await prisma.projectPost.update({
      where: { projectId },
      data: {
        provenance: {
          ...provenance,
          interview: {
            ...interview,
            audio: { ...(interview.audio ?? {}), [questionId]: entry },
          },
        } as any,
      },
    });

    return audioUrl;
  } catch (error) {
    console.error("[interview/transcribe] Audio retention failed:", error);
    return null;
  }
}

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";
const OPENAI_ENABLED =
  !!process.env.OPENAI_API_KEY && process.env.OPENAI_ENABLED !== "false";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const spotlightBoundary = await legacyInterviewBoundary(request);
  if (spotlightBoundary) return spotlightBoundary;

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

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
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

      // Transcribe with Whisper. verbose_json + word granularity is what makes a
      // published quote resolvable to a time span; without it the recording is
      // retained but uncuttable (spec 21 delta D5a).
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "en", // Optional: specify language for better accuracy
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      });

      const transcript = transcription.text?.trim() || "";

      if (!transcript) {
        return NextResponse.json(
          { error: "transcription_empty", message: "No transcript generated from audio" },
          { status: 422 }
        );
      }

      const words: AnswerAudio["words"] = Array.isArray((transcription as any).words)
        ? (transcription as any).words.map((w: any) => ({
            word: String(w.word ?? ""),
            start: Number(w.start ?? 0),
            end: Number(w.end ?? 0),
          }))
        : [];

      // Retain the recording. Non-blocking on failure: the answer is the critical
      // path, the recording is the asset.
      const audioUrl = questionId
        ? await retainAudio(projectId, questionId, audioFile, buffer, words)
        : null;

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
              // Whether this answer is film-eligible. A false here is a silent
              // retention failure worth seeing in aggregate.
              audioRetained: !!audioUrl,
              wordTimings: words.length,
            },
          });
        })
        .catch((analyticsError) => {
          console.warn("Analytics logging failed (non-blocking):", analyticsError);
        });

      return NextResponse.json(
        {
          ok: true,
          transcript,
          questionId: questionId || undefined,
          audioUrl: audioUrl || undefined,
          words: words.length ? words : undefined,
        },
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


