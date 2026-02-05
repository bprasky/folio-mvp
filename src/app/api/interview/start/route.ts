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
 * Returns initial questions and project context.
 */

const RequestSchema = z.object({
  projectId: z.string().min(1),
  mode: z.enum(["voice", "text"]),
});

// Default questions for Level 0 (no context)
const DEFAULT_QUESTIONS = [
  {
    id: `default-${randomUUID()}`,
    text: "Tell us about this project and what made it special.",
    source: "default" as const,
  },
  {
    id: `default-${randomUUID()}`,
    text: "What was the initial vision for this space?",
    source: "default" as const,
  },
  {
    id: `default-${randomUUID()}`,
    text: "How would you describe the overall aesthetic?",
    source: "default" as const,
  },
  {
    id: `default-${randomUUID()}`,
    text: "Is there a piece in this project that anchors the whole design?",
    source: "default" as const,
  },
  {
    id: `default-${randomUUID()}`,
    text: "What do you hope people feel when they walk into this space?",
    source: "default" as const,
  },
];

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
      select: { id: true, orgRole: true },
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
        name: true,
        images: {
          select: { id: true, url: true, name: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create or get EditorialInterview
    let interview = await prisma.editorialInterview.findUnique({
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

    // Generate session ID
    const sessionId = `session-${randomUUID()}`;

    // Try to generate personalized questions based on project images
    let questions = [...DEFAULT_QUESTIONS];

    // For now, use default questions. In the future, we can integrate with
    // the AI image analysis to generate personalized questions based on
    // detected colors, materials, styles, etc.

    // Get hero image
    const heroImageUrl = project.images[0]?.url ?? null;

    return NextResponse.json({
      sessionId,
      initialQuestions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        source: q.source,
      })),
      projectContext: {
        title: project.name ?? "Untitled Project",
        imageCount: project.images.length,
        heroImageUrl,
      },
    });
  } catch (error) {
    console.error("[/api/interview/start] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
