import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { spotlightEnrolled, SpotlightConflict } from "./gate";

export function assertLegacyInterviewAllowed(projectId: string) {
  if (spotlightEnrolled(projectId))
    throw new SpotlightConflict(
      "PRIVATE_INTERVIEW_REQUIRED",
      "Use the private spotlight interview for this enrolled project. Legacy generation and realtime extraction are paused.",
    );
}

/** Route adapter checks before caches, generation, conversion or persistence. */
export async function legacyInterviewBoundary(request: Request) {
  const url = new URL(request.url);
  const pathProject = url.pathname.match(/\/projects?\/([^/]+)/)?.[1];
  let body: Record<string, unknown> = {};
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      body = await request.clone().json();
    } catch {
      /* Original handler validates malformed requests. */
    }
  }
  const ids = [pathProject, url.searchParams.get("projectId"), body.projectId];
  const sessionId = body.sessionId || url.searchParams.get("sessionId");
  if (typeof sessionId === "string" && url.pathname.includes("/realtime/")) {
    const session = await prisma.realtimeInterviewSession.findUnique({
      where: { id: sessionId },
      select: { projectId: true },
    });
    ids.push(session?.projectId);
  }
  if (
    ids.some(
      (id) =>
        typeof id === "string" && spotlightEnrolled(decodeURIComponent(id)),
    )
  )
    return NextResponse.json(
      {
        code: "PRIVATE_INTERVIEW_REQUIRED",
        error:
          "Use the private spotlight interview. Legacy generation and realtime extraction are paused for this project.",
      },
      { status: 409 },
    );
  return null;
}
