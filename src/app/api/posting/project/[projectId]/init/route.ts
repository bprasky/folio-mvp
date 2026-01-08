export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { makeSlug } from "@/lib/posting/slug";

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;

    // Check project access
    await assertProjectView(session.user.id, projectId);

    // Check if post already exists
    const existing = await prisma.projectPost.findUnique({
      where: { projectId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Post already exists for this project" },
        { status: 409 }
      );
    }

    // Get project for title
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Generate unique slug
    const slug = makeSlug(project.title || undefined, projectId);

    // Create DRAFT post
    const post = await prisma.projectPost.create({
      data: {
        projectId,
        slug,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[posting/init] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


