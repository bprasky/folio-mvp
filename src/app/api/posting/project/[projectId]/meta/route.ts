export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { PostMetaSchema } from "@/lib/posting/schemas";
import { normalizeRole } from "@/lib/permissions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.projectId;
    const role = normalizeRole(session?.user?.role);

    // Check project access (DESIGNER owner or ADMIN)
    await assertProjectView(session.user.id, projectId);

    // Verify role permission
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

    // Validate input
    const body = await request.json();
    const validated = PostMetaSchema.parse(body);

    // Verify heroAssetId exists if provided
    if (validated.heroAssetId) {
      const image = await prisma.projectImage.findUnique({
        where: { id: validated.heroAssetId },
        select: { projectId: true },
      });

      if (!image || image.projectId !== projectId) {
        return NextResponse.json(
          { error: "Invalid heroAssetId" },
          { status: 400 }
        );
      }
    }

    // Check if post exists, create if not
    let post = await prisma.projectPost.findUnique({
      where: { projectId },
    });

    if (!post) {
      // Create post if it doesn't exist
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { title: true },
      });
      
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      const { makeSlug } = await import("@/lib/posting/slug");
      const slug = makeSlug(project.title || undefined, projectId);

      post = await prisma.projectPost.create({
        data: {
          projectId,
          slug,
          status: "DRAFT",
          heroAssetId: validated.heroAssetId ?? undefined,
          excerpt: validated.excerpt ?? undefined,
          keywords: validated.keywords ?? undefined,
          variant: validated.variant ?? undefined,
        },
      });
    } else {
      // Update existing post
      post = await prisma.projectPost.update({
        where: { projectId },
        data: {
          heroAssetId: validated.heroAssetId ?? undefined,
          excerpt: validated.excerpt ?? undefined,
          keywords: validated.keywords ?? undefined,
          variant: validated.variant ?? undefined,
        },
      });
    }

    return NextResponse.json({ ok: true, post });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", issues: error.errors },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[posting/meta] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

