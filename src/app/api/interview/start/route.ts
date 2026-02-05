export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { z } from "zod";
import { randomUUID } from "crypto";

/**
 * POST /api/interview/start
 *
 * Initialize a new interview session.
 * Returns contextual questions (based on AI classification) and project context.
 */

const RequestSchema = z.object({
  projectId: z.string().min(1),
  mode: z.enum(["voice", "text"]),
});

// Minimal fallback if contextual system fails entirely
const FALLBACK_QUESTIONS = [
  { id: "fallback-1", text: "Tell us about this project and what made it special.", source: "default" as const },
  { id: "fallback-2", text: "What was the initial vision for this space?", source: "default" as const },
  { id: "fallback-3", text: "How would you describe the overall aesthetic?", source: "default" as const },
  { id: "fallback-4", text: "Is there a piece in this project that anchors the whole design?", source: "default" as const },
  { id: "fallback-5", text: "What do you hope people feel when they walk into this space?", source: "default" as const },
];

// Map contextual question sources to the InterviewQuestion source format
function mapSource(source: string): "ai-personalized" | "ai-followup" | "default" {
  if (source === "ai_classification" || source === "contextual") return "ai-personalized";
  if (source === "follow_up") return "ai-followup";
  return "default";
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { projectId, mode } = parsed.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify project access
    await assertProjectView(user.id, projectId);

    // Get project with images
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        images: {
          select: { id: true, url: true, name: true, aiClassification: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create or get EditorialInterview
    let interview: any = null;
    try {
      interview = await prisma.editorialInterview.findUnique({
        where: { projectId },
      });

      if (!interview) {
        interview = await prisma.editorialInterview.create({
          data: {
            projectId,
            status: "IN_PROGRESS",
            selectedQuestionIds: [],
          },
        });
      }
    } catch (dbError: any) {
      console.warn("[/api/interview/start] EditorialInterview DB error:", dbError?.message);
      interview = { id: `temp-${randomUUID()}`, projectId, status: "IN_PROGRESS" };
    }

    // Generate session ID
    const sessionId = `session-${randomUUID()}`;

    // Generate contextual questions using AI classification data
    let questions: Array<{ id: string; text: string; source: "ai-personalized" | "ai-followup" | "default"; relatedImageId?: string; context?: string }>;
    let contextLevel = 0;
    let contextDescription = "No project context available";
    let upgradeSuggestion: string | null = "Upload project photos to unlock personalized questions";

    try {
      const { getInterviewQuestionsWithContext } = await import("@/lib/editorial/getInterviewQuestions");
      const result = await getInterviewQuestionsWithContext(projectId, {
        maxQuestions: 15,
        prioritizeBoostable: true,
      });

      contextLevel = result.contextLevel;
      contextDescription = result.contextDescription;
      upgradeSuggestion = result.upgradeSuggestion;

      // Map to the InterviewQuestion format expected by the frontend
      questions = result.questions.map((q) => ({
        id: q.id,
        text: q.questionText,
        source: mapSource(q.source),
        relatedImageId: q.linkedImageId,
        context: q.roomContext,
      }));

      console.log(`[/api/interview/start] Generated ${questions.length} questions at context level ${contextLevel} for project ${projectId}`);
    } catch (questionError: any) {
      console.error("[/api/interview/start] Failed to generate contextual questions:", questionError?.message);
      questions = [...FALLBACK_QUESTIONS];
    }

    // Get hero image
    const heroImageUrl = project.images[0]?.url ?? null;

    // Count classified images for readiness info
    const classifiedCount = project.images.filter((img) => img.aiClassification != null).length;

    return NextResponse.json({
      sessionId,
      initialQuestions: questions,
      projectContext: {
        title: project.title ?? "Untitled Project",
        imageCount: project.images.length,
        heroImageUrl,
      },
      // Extended context info (frontend can optionally use these)
      contextLevel,
      contextDescription,
      upgradeSuggestion,
      readiness: {
        images: project.images.length,
        classified: classifiedCount,
        hasClassifications: classifiedCount > 0,
      },
    });
  } catch (error: any) {
    if (error?.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[/api/interview/start] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
