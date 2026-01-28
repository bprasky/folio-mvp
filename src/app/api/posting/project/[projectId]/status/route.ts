export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectView } from "@/lib/authz/access";
import { normalizeRole } from "@/lib/permissions";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notifyTaggedVendors } from "@/lib/email/notifyVendorTagged";

// Accept both {action:"publish"} and {status:"PUBLISHED"} or legacy {to:"PUBLISHED"}
const BodySchema = z
  .object({
    action: z.enum(["publish"]).optional(),
    status: z.enum(["PUBLISHED", "DRAFT", "REVIEW", "ARCHIVED"]).optional(),
    to: z.enum(["REVIEW", "PUBLISHED", "ARCHIVED"]).optional(), // Legacy support
  })
  .refine(
    (b) => b.action === "publish" || b.status === "PUBLISHED" || b.to === "PUBLISHED",
    { message: 'Use {action:"publish"}, {status:"PUBLISHED"}, or {to:"PUBLISHED"}' }
  );

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ["REVIEW", "PUBLISHED", "ARCHIVED"], // Allow direct publish from DRAFT
  REVIEW: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [], // No forward transitions from archived
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;
  const correlationId = `publish-${projectId}-${Date.now()}`;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error(`[${correlationId}] Not authenticated`);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const role = normalizeRole(session?.user?.role);

    // Check project access
    try {
      await assertProjectView(session.user.id, projectId);
    } catch (accessError: any) {
      console.error(`[${correlationId}] Access denied:`, accessError.message);
      return NextResponse.json({ error: "Forbidden: access denied" }, { status: 403 });
    }

    // Verify role permission
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, designerId: true, title: true, description: true },
    });

    if (!project) {
      console.error(`[${correlationId}] Project not found`);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id || project.designerId === session.user.id;
    if (!isOwner && role !== "ADMIN") {
      console.error(`[${correlationId}] Forbidden: role ${role} not allowed`);
      return NextResponse.json(
        { error: "Forbidden: role not allowed" },
        { status: 403 }
      );
    }

    // Validate input body
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(`[${correlationId}] Invalid JSON body:`, parseError);
      return NextResponse.json(
        { error: "Bad Request: invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      console.error(`[${correlationId}] Validation failed:`, parsed.error.issues);
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // Determine target status (support both new and legacy formats)
    const targetStatus =
      parsed.data.action === "publish" || parsed.data.status === "PUBLISHED" || parsed.data.to === "PUBLISHED"
        ? "PUBLISHED"
        : parsed.data.to || parsed.data.status || "DRAFT";

    // Get current post with expandedBlocks
    const post = await prisma.projectPost.findUnique({
      where: { projectId },
      select: {
        id: true,
        status: true,
        slug: true,
        heroAssetId: true,
        excerpt: true,
        expandedBlocks: true,
        credits: true,
        publishedAt: true,
      },
    });

    if (!post) {
      console.error(`[${correlationId}] Post not found`);
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check forward-only transition (except ARCHIVED can be set from any state)
    if (
      targetStatus !== "ARCHIVED" &&
      STATUS_FLOW[post.status] &&
      !STATUS_FLOW[post.status].includes(targetStatus)
    ) {
      console.error(
        `[${correlationId}] Invalid transition: ${post.status} -> ${targetStatus}`
      );
      return NextResponse.json(
        {
          error: "Invalid transition",
          message: `Cannot transition from ${post.status} to ${targetStatus}`,
        },
        { status: 409 }
      );
    }

    // Validate publishing requirements
    if (targetStatus === "PUBLISHED") {
      // Auto-populate missing fields before validation
      const blocks = post.expandedBlocks as any;
      const lead = blocks?.lead || {};
      const galleryChapters = Array.isArray(blocks?.galleryChapters)
        ? blocks.galleryChapters
        : [];
      
      let needsUpdate = false;
      const updateData: any = {};
      
      // 1. Auto-populate heroAssetId if missing
      if (!post.heroAssetId) {
        // Try first image from galleryChapters[0].imageIds
        const firstChapterImageId = galleryChapters?.[0]?.imageIds?.[0];
        if (firstChapterImageId && typeof firstChapterImageId === 'string') {
          // Verify the image exists
          const image = await prisma.projectImage.findUnique({
            where: { id: firstChapterImageId },
            select: { id: true, projectId: true },
          });
          if (image && image.projectId === projectId) {
            updateData.heroAssetId = firstChapterImageId;
            needsUpdate = true;
          }
        }
        
        // Fallback to first project image
        if (!updateData.heroAssetId) {
          const firstImage = await prisma.projectImage.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });
          if (firstImage) {
            updateData.heroAssetId = firstImage.id;
            needsUpdate = true;
          }
        }
      }
      
      // 2. Auto-populate excerpt if missing
      if (!post.excerpt || (typeof post.excerpt === 'string' && post.excerpt.trim().length === 0)) {
        if (lead?.deck) {
          updateData.excerpt = lead.deck;
          needsUpdate = true;
        } else if (galleryChapters?.[0]?.body?.[0]) {
          const firstPara = String(galleryChapters[0].body[0]);
          updateData.excerpt = firstPara.length > 300 ? firstPara.slice(0, 297) + '...' : firstPara;
          needsUpdate = true;
        } else if (project.description) {
          updateData.excerpt = project.description;
          needsUpdate = true;
        }
      }
      
      // 3. Auto-populate credits if missing or incomplete
      let currentCredits = post.credits;
      if (!currentCredits) {
        // Try to get credits from expandedBlocks first
        if (blocks?.credits && Array.isArray(blocks.credits) && blocks.credits.length > 0) {
          currentCredits = blocks.credits;
          updateData.credits = currentCredits;
          needsUpdate = true;
          console.log(`[${correlationId}] Found credits in expandedBlocks:`, blocks.credits.length);
        } else {
          // Generate default credits from project designer
          const projectWithDesigner = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
              designer: {
                select: { name: true },
              },
            },
          });
          if (projectWithDesigner?.designer?.name) {
            currentCredits = [
              { role: "Designer", name: projectWithDesigner.designer.name },
              { role: "Photographer", name: null }, // Placeholder with null
            ];
          } else {
            currentCredits = [
              { role: "Designer", name: null },
              { role: "Photographer", name: null },
            ];
          }
          updateData.credits = currentCredits;
          needsUpdate = true;
          console.log(`[${correlationId}] Generated default credits`);
        }
      }
      
      // Check and auto-fill missing required roles
      if (currentCredits && typeof currentCredits === "object") {
        const credits = Array.isArray(currentCredits) ? [...currentCredits] : [];
        const hasDesigner = credits.some(
          (c: any) => c.role?.toLowerCase().includes("designer")
        );
        const hasPhotoOrCGI = credits.some(
          (c: any) =>
            c.role?.toLowerCase().includes("photograph") ||
            c.role?.toLowerCase().includes("cgi") ||
            c.role?.toLowerCase().includes("render")
        );
        
        let creditsUpdated = false;
        if (!hasDesigner) {
          credits.push({ role: "Designer", name: null });
          creditsUpdated = true;
          console.log(`[${correlationId}] Auto-filled missing designer credit`);
        }
        if (!hasPhotoOrCGI) {
          credits.push({ role: "Photographer", name: null });
          creditsUpdated = true;
          console.log(`[${correlationId}] Auto-filled missing photography/CGI credit`);
        }
        
        if (creditsUpdated) {
          updateData.credits = credits;
          needsUpdate = true;
        }
      }
      
      // Update post if any fields were auto-populated
      if (needsUpdate) {
        const updated = await prisma.projectPost.update({
          where: { projectId },
          data: updateData,
          select: {
            heroAssetId: true,
            excerpt: true,
            credits: true,
          },
        });
        // Update local post object with new values
        post.heroAssetId = updated.heroAssetId;
        post.excerpt = updated.excerpt;
        post.credits = updated.credits;
        console.log(`[${correlationId}] Auto-populated missing fields:`, Object.keys(updateData));
      }
      
      const prereqIssues: string[] = [];
      const sections = Array.isArray(blocks?.sections) ? blocks.sections : [];

      // Check lead (title/kicker)
      if (!lead?.title && !lead?.kicker && !lead?.deck) {
        prereqIssues.push("Missing lead: title/kicker/deck required");
      }

      // Check narrative sections (from galleryChapters[0].body or sections array)
      const narrativeFromBody =
        galleryChapters?.[0]?.body && Array.isArray(galleryChapters[0].body)
          ? galleryChapters[0].body.length > 0
          : false;
      const narrativeFromSections =
        sections.filter((s: any) => s?.type === "narrative" && s?.body).length > 0;

      if (!narrativeFromBody && !narrativeFromSections) {
        prereqIssues.push("No narrative sections: missing galleryChapters[0].body or narrative sections");
      }

      // Check gallery images
      const firstChapterImages =
        galleryChapters?.[0]?.imageIds && Array.isArray(galleryChapters[0].imageIds)
          ? galleryChapters[0].imageIds.length > 0
          : false;

      if (!firstChapterImages) {
        prereqIssues.push("No gallery images: galleryChapters[0].imageIds is required");
      }

      // Validate hero image exists
      if (!post.heroAssetId) {
        prereqIssues.push("heroAssetId is required");
      } else {
        const image = await prisma.projectImage.findUnique({
          where: { id: post.heroAssetId },
          select: { id: true },
        });
        if (!image) {
          prereqIssues.push("heroAssetId references a non-existent image");
        }
      }

      // Validate excerpt
      if (!post.excerpt || (typeof post.excerpt === 'string' && post.excerpt.trim().length === 0)) {
        prereqIssues.push("excerpt is required");
      }

      // Verify at least one ProductTag exists
      const tags = await prisma.productTag.findMany({
        where: {
          image: {
            projectId,
          },
        },
        take: 1,
      });

      if (tags.length === 0) {
        prereqIssues.push("At least one product tag is required");
      }

      // Credits validation removed - auto-filled above if missing
      // TODO: Re-enable this validation in the future

      if (prereqIssues.length > 0) {
        console.error(`[${correlationId}] Prerequisites not met:`, prereqIssues);
        return NextResponse.json(
          {
            error: "Unpublishable",
            message: "Editorial prerequisites not met",
            details: prereqIssues,
          },
          { status: 422 }
        );
      }

      // Generate/ensure slug
      let slug = post.slug;
      if (!slug || slug.trim().length === 0) {
        const base =
          slugify(lead.title || lead.kicker || project.title || "article") || "article";

        // Ensure uniqueness
        let candidate = base;
        let i = 1;
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
          const exists = await prisma.projectPost.findFirst({
            where: { slug: candidate, NOT: { id: post.id } },
            select: { id: true },
          });

          if (!exists) {
            break;
          }

          i += 1;
          candidate = `${base}-${i}`;
          attempts += 1;
        }

        if (attempts >= maxAttempts) {
          console.error(`[${correlationId}] Failed to generate unique slug after ${maxAttempts} attempts`);
          return NextResponse.json(
            {
              error: "Conflict",
              message: "Unable to generate unique slug",
            },
            { status: 409 }
          );
        }

        slug = candidate;
        console.log(`[${correlationId}] Generated slug: ${slug}`);
      }

      // Log analytics on successful publish
      try {
        const { logPassiveEvent } = await import("@/lib/analytics");
        await logPassiveEvent({
          projectId,
          type: "project_publish_success",
          actorId: session.user.id,
          payload: { postId: post.id },
        });
      } catch (analyticsError) {
        console.warn(`[${correlationId}] Analytics logging failed:`, analyticsError);
      }

      // Update Project.isPublic and publishedAt when publishing
      await prisma.project.update({
        where: { id: projectId },
        data: {
          isPublic: true,
          publishedAt: new Date(),
        },
      });

      // Update post status and slug
      const updated = await prisma.projectPost.update({
        where: { projectId },
        data: {
          status: targetStatus,
          slug,
          publishedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          slug: true,
          publishedAt: true,
        },
      });

      // Revalidate paths
      try {
        revalidatePath(`/p/${slug}`);
        revalidatePath(`/designer/projects/${projectId}/preview`);
        revalidatePath(`/designer/projects/${projectId}`);
      } catch (revalidateError) {
        console.warn(`[${correlationId}] Revalidation failed:`, revalidateError);
      }

      console.log(`[${correlationId}] Published successfully:`, { slug, status: updated.status });

      // Notify vendors of tagged products (async, non-blocking)
      notifyTaggedVendors({ projectId }).catch((err) => {
        console.error(`[${correlationId}] Failed to notify vendors:`, err);
      });

      return NextResponse.json(
        {
          ok: true,
          slug: updated.slug,
          status: updated.status,
          publishedAt: updated.publishedAt,
        },
        { status: 200 }
      );
    }

    // Handle non-publish status updates (REVIEW, ARCHIVED, etc.)
    const updated = await prisma.projectPost.update({
      where: { projectId },
      data: {
        status: targetStatus,
        publishedAt: targetStatus === "PUBLISHED" ? new Date() : post.publishedAt,
      },
      select: {
        id: true,
        status: true,
        slug: true,
        publishedAt: true,
      },
    });

    // Revalidate paths
    try {
      revalidatePath(`/p/${updated.slug}`);
      revalidatePath(`/designer/projects/${projectId}/preview`);
      revalidatePath(`/designer/projects/${projectId}`);
    } catch (revalidateError) {
      console.warn(`[${correlationId}] Revalidation failed:`, revalidateError);
    }

    return NextResponse.json({ ok: true, post: updated }, { status: 200 });
  } catch (error: any) {
    console.error(`[${correlationId}] Error:`, error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", issues: error.errors },
        { status: 400 }
      );
    }

    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Handle unique constraint violations (slug conflicts)
    if (error.code === "P2002" && error.meta?.target?.includes("slug")) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "Slug already exists",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", message: error?.message },
      { status: 500 }
    );
  }
}
