export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/posting/llmClient";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MODELS } from '@/lib/ai/models';

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
      select: {
        id: true,
        createdByUserId: true,
        status: true,
        recordingAsset: {
          select: {
            id: true,
            url: true,
            storageKey: true,
            mimeType: true,
          },
        },
        projectId: true,
        productId: true,
        project: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
          },
        },
      },
    });

    if (!interviewSession) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }

    if (interviewSession.createdByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden: not interview owner" }, { status: 403 });
    }

    if (interviewSession.status !== "UPLOADED") {
      return NextResponse.json(
        { error: `Cannot process: interview is in ${interviewSession.status} status. Must be UPLOADED.` },
        { status: 400 }
      );
    }

    if (!interviewSession.recordingAsset) {
      return NextResponse.json(
        { error: "No recording asset found" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Step 1: Update status to TRANSCRIBING
    await prisma.interviewSession.update({
      where: { id: interviewId },
      data: { status: "TRANSCRIBING" },
    });

    // Step 2: Download audio file and transcribe with Whisper
    let transcriptSegments: Array<{ start: number; end: number; text: string }> = [];
    let fullTranscript = "";

    try {
      // Download the audio file from Supabase URL
      const audioResponse = await fetch(interviewSession.recordingAsset.url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
      }

      const audioBlob = await audioResponse.blob();
      const audioFile = new File([audioBlob], "recording.webm", { type: interviewSession.recordingAsset.mimeType });

      // Transcribe with Whisper (verbose_json format for timestamps)
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      // Extract segments from Whisper response
      if (transcription.segments && Array.isArray(transcription.segments)) {
        transcriptSegments = transcription.segments.map((seg: any) => ({
          start: Math.round(seg.start * 1000), // Convert to milliseconds
          end: Math.round(seg.end * 1000),
          text: seg.text.trim(),
        }));
        fullTranscript = transcription.text || transcriptSegments.map((s) => s.text).join(" ");
      } else {
        // Fallback: create single segment from full text
        fullTranscript = transcription.text || "";
        transcriptSegments = [{
          start: 0,
          end: Math.round((transcription.duration || 0) * 1000),
          text: fullTranscript,
        }];
      }

      // Store transcript segments in database
      await prisma.transcriptSegment.createMany({
        data: transcriptSegments.map((seg, index) => ({
          interviewSessionId: interviewId,
          order: index,
          speaker: "designer",
          startMs: seg.start,
          endMs: seg.end,
          text: seg.text,
        })),
      });

      // Update status to TRANSCRIBED
      await prisma.interviewSession.update({
        where: { id: interviewId },
        data: {
          status: "TRANSCRIBED",
          transcribedAt: new Date(),
        },
      });
    } catch (transcriptionError) {
      console.error("[interviews/process] Transcription error:", transcriptionError);
      await prisma.interviewSession.update({
        where: { id: interviewId },
        data: {
          status: "UPLOADED",
          errorMessage: `Transcription failed: ${transcriptionError instanceof Error ? transcriptionError.message : "Unknown error"}`,
        },
      });
      return NextResponse.json(
        { error: "Transcription failed", details: transcriptionError instanceof Error ? transcriptionError.message : "Unknown error" },
        { status: 500 }
      );
    }

    // Step 3: Extract quotes using GPT
    await prisma.interviewSession.update({
      where: { id: interviewId },
      data: { status: "EXTRACTING" },
    });

    try {
      // Build context for quote extraction
      const context = {
        project: interviewSession.project
          ? {
              title: interviewSession.project.title,
              description: interviewSession.project.description,
            }
          : null,
        product: interviewSession.product
          ? {
              name: interviewSession.product.name,
              brand: interviewSession.product.brand,
            }
          : null,
        transcript: fullTranscript,
        segments: transcriptSegments,
      };

      // Determine use cases based on interview type
      const useCases: Array<"EDITORIAL_PULLQUOTE" | "PRODUCT_PAGE_INSIGHT"> = [];
      if (interviewSession.projectId) {
        useCases.push("EDITORIAL_PULLQUOTE");
      }
      if (interviewSession.productId) {
        useCases.push("PRODUCT_PAGE_INSIGHT");
      }

      if (useCases.length === 0) {
        useCases.push("EDITORIAL_PULLQUOTE"); // Default fallback
      }

      // Build extraction prompt
      const systemPrompt = `You are a quote extraction assistant for Folio, a premium interior design platform. Extract the best quotes from interview transcripts that capture design philosophy, material decisions, and authentic designer insights.`;

      const userPrompt = `Extract 2-5 best quotes from this interview transcript.

Context:
${interviewSession.project ? `Project: ${interviewSession.project.title} - ${interviewSession.project.description || ""}` : ""}
${interviewSession.product ? `Product: ${interviewSession.product.brand} ${interviewSession.product.name}` : ""}

Transcript:
${fullTranscript}

Segment timestamps:
${transcriptSegments.map((s, i) => `[${i}] ${s.start}ms-${s.end}ms: ${s.text}`).join("\n")}

Requirements:
- Extract quotes that are ${useCases.join(" or ")} quality
- Return EXACT timestamp ranges that map to transcript segment boundaries
- Quotes should be verbatim from transcript (light cleanup ok for readability)
- Each quote should be 1-3 sentences, emotionally resonant or insightfully specific
- Score each quote 0-1 based on quality (designer insight, specificity, quotability)

Return JSON array:
[
  {
    "startMs": 12345,
    "endMs": 15678,
    "quoteText": "Exact quote text...",
    "useCase": "${useCases[0]}",
    "score": 0.85
  }
]`;

      const anthropic = new Anthropic();
      const modelName = MODELS.sonnet;

      const extractionResult = await callLLM(
        async () => {
          return await anthropic.messages.create({
            model: modelName,
            thinking: { type: 'disabled' },
            max_tokens: 2000,
            system: systemPrompt,
            messages: [
              { role: "user", content: userPrompt },
            ],
          });
        },
        { modelName, contextHint: `extract:${interviewId}`, baseDelayMs: 500 }
      );

      if (!extractionResult.ok) {
        const errorResult = extractionResult as { ok: false; code: string; message: string };
        throw new Error(`Extraction failed: ${errorResult.code} - ${errorResult.message}`);
      }

      // Parse extraction response
      const rawExtraction = extractionResult.data.content[0]?.type === "text" ? extractionResult.data.content[0].text : null;
      const extractionContent = rawExtraction ? rawExtraction.replace(/```json\n?|\n?```/g, "").trim() : null;
      if (!extractionContent) {
        throw new Error("No extraction content returned");
      }

      let extractionData: any;
      try {
        extractionData = JSON.parse(extractionContent);
      } catch (parseError) {
        // Try to extract array from response
        const arrayMatch = extractionContent.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          extractionData = { quotes: JSON.parse(arrayMatch[0]) };
        } else {
          throw new Error("Failed to parse extraction response");
        }
      }

      const quotes = extractionData.quotes || extractionData || [];
      if (!Array.isArray(quotes) || quotes.length === 0) {
        throw new Error("No quotes extracted");
      }

      // Store quote highlights
      const highlightsToCreate = quotes.map((quote: any) => ({
        interviewSessionId: interviewId,
        startMs: Math.round(quote.startMs || quote.start || 0),
        endMs: Math.round(quote.endMs || quote.end || 0),
        quoteText: (quote.quoteText || quote.text || "").trim(),
        useCase: (quote.useCase || useCases[0]) as "EDITORIAL_PULLQUOTE" | "PRODUCT_PAGE_INSIGHT" | "SOCIAL_CLIP_HOOK",
        score: Math.max(0, Math.min(1, quote.score || 0.5)),
        approvedByDesigner: false,
        productId: interviewSession.productId || null,
      }));

      await prisma.quoteHighlight.createMany({
        data: highlightsToCreate,
      });

      // Update status to EXTRACTED
      await prisma.interviewSession.update({
        where: { id: interviewId },
        data: {
          status: "EXTRACTED",
          extractedAt: new Date(),
        },
      });

      return NextResponse.json({
        ok: true,
        interviewSession: {
          id: interviewId,
          status: "EXTRACTED",
        },
        transcriptSegments: transcriptSegments.length,
        quotesExtracted: highlightsToCreate.length,
      });
    } catch (extractionError) {
      console.error("[interviews/process] Extraction error:", extractionError);
      await prisma.interviewSession.update({
        where: { id: interviewId },
        data: {
          status: "TRANSCRIBED",
          errorMessage: `Extraction failed: ${extractionError instanceof Error ? extractionError.message : "Unknown error"}`,
        },
      });
      return NextResponse.json(
        { error: "Extraction failed", details: extractionError instanceof Error ? extractionError.message : "Unknown error" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[interviews/process] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}



