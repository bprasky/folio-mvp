import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectEdit } from "@/lib/authz/access";
import { CreditsArraySchema, parseCredits } from "@/lib/posting/creditsSchema";

/**
 * GET /api/posting/project/[projectId]/credits
 * Returns current credits for the project post.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;

    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: {
        credits: true,
        project: {
          select: {
            designer: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const credits = parseCredits(post.credits);
    const designerName = post.project?.designer?.name || null;

    return NextResponse.json({ credits, designerName });
  } catch (error: any) {
    console.error("[credits/GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/posting/project/[projectId]/credits
 * Replace all credits for the project post.
 * The Designer credit is validated server-side — it must be present and cannot be removed.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    await assertProjectEdit(session.user.id, projectId);

    const body = await request.json();
    const parsed = CreditsArraySchema.safeParse(body.credits);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credits", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    // Ensure Designer credit exists
    const hasDesigner = parsed.data.some(
      (c) => c.role.toLowerCase() === "designer"
    );
    if (!hasDesigner) {
      // Fetch designer name and prepend
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { designer: { select: { name: true } } },
      });
      parsed.data.unshift({
        role: "Designer",
        name: project?.designer?.name || "Designer",
      });
    }

    const updated = await prisma.projectPost.update({
      where: { projectId },
      data: { credits: parsed.data },
      select: { credits: true },
    });

    return NextResponse.json({
      ok: true,
      credits: parseCredits(updated.credits),
    });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[credits/PUT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
