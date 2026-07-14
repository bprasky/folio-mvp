export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { assertProjectWrite, assertProjectPublish } from "@/lib/authz/access";
import { canPublishFromOrg, type PublishGateResult } from "@/lib/permissions";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notifyTaggedVendors } from "@/lib/email/notifyVendorTagged";
import { triggerQueueUnlockForProject } from "@/lib/editorial-queue/unlock";

// Accept {action:"publish"}, {action:"unpublish"}, {status:...}, or legacy {to:...}
const BodySchema = z
  .object({
    action: z.enum(["publish", "unpublish"]).optional(),
    status: z.enum(["PUBLISHED", "DRAFT", "REVIEW", "ARCHIVED"]).optional(),
    to: z.enum(["REVIEW", "PUBLISHED", "ARCHIVED", "DRAFT"]).optional(), // Legacy support
  })
  .refine(
    (b) => b.action === "publish" || b.action === "unpublish" || b.status || b.to,
    { message: 'Provide action, status, or to field' }
  );

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ["REVIEW", "PUBLISHED", "ARCHIVED"], // Allow direct publish from DRAFT
  REVIEW: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [], // No forward transitions from archived
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

const POSTING_V1_ENABLED =
  (process.env.POSTING_V1 ?? "").toLowerCase() === "true" ||
  (process.env.NEXT_PUBLIC_POSTING_V1 ?? "").toLowerCase() === "true" ||
  process.env.NODE_ENV !== "production";

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

    // Check project write access (owner, designer, org member, or admin)
    try {
      await assertProjectWrite(session.user.id, projectId);
    } catch (e: any) {
      if (e.message === "NotFound") {
        console.error(`[${correlationId}] Project not found`);
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      console.error(`[${correlationId}] Forbidden`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { title: true, description: true, designerOrgId: true },
    });

    if (!project) {
      console.error(`[${correlationId}] Project not found`);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
        : parsed.data.action === "unpublish"
        ? "DRAFT"
        : parsed.data.to || parsed.data.status || "DRAFT";

    // Gate Posting V1 publish attempts on the feature flag. Unpublish/archive
    // remain reachable because usePublishFlow.ts:278 uses this endpoint for
    // unpublish on the legacy (flag-off) Path B as well.
    if (targetStatus === "PUBLISHED" && !POSTING_V1_ENABLED) {
      return NextResponse.json({ error: "Posting V1 not enabled" }, { status: 404 });
    }

    // Org-status gate: publishing requires the backing organization to be
    // CLAIMED or PROFESSIONAL. Designers tied to an UNCLAIMED placeholder
    // (the "I work here, someone else will set up the page" path) can draft
    // and stage projects, but they can't broadcast on a firm page that
    // hasn't been claimed yet. See docs/AUTH_ORG_ENROLLMENT_FLOW.md.
    if (targetStatus === "PUBLISHED") {
      const gate: PublishGateResult = await canPublishFromOrg(
        session.user.id,
        project.designerOrgId
      );
      if (gate.ok === false) {
        console.error(`[${correlationId}] Publish gate: ${gate.reason}`);
        const message =
          gate.reason === 'org_unclaimed'
            ? "Your firm page isn't set up yet — drafts only until it's claimed."
            : gate.reason === 'no_org'
            ? "You need to be a member of a Folio organization before you can publish."
            : 'You can\'t publish from this organization yet.';
        return NextResponse.json(
          { error: 'Forbidden', reason: gate.reason, message },
          { status: 403 }
        );
      }
    }

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
      // Publish capability gate (Owner/Admin/Manager of org, or non-org
      // creator, or global admin). The top-of-route assertProjectWrite
      // already checked write access; this narrows further to publish.
      try {
        await assertProjectPublish(session.user.id, projectId);
      } catch {
        return NextResponse.json(
          { error: "Forbidden", message: "You do not have permission to publish this project." },
          { status: 403 }
        );
      }
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
      // Note: Credits now use the CreditEntry schema from creditsSchema.ts which supports
      // multi-party credits (architect, contractor, photographer, stylist, etc.).
      // The CreditsEditor on the preview page allows designers to add credits before/after
      // generation. This auto-population is a fallback for posts that go through publish
      // without any credits being set.
      // Future (Super Articles): Credits will include userId linking to contributor
      // InterviewSessions and contributionStatus tracking.
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
      
      // Check and auto-fill missing Designer credit only.
      // We no longer auto-add null-name placeholders (e.g. "Photographer: null")
      // because the CreditsEditor lets designers explicitly choose who to credit.
      // Adding null-name entries overwrites that intentional choice.
      if (currentCredits && typeof currentCredits === "object") {
        const credits = Array.isArray(currentCredits) ? [...currentCredits] : [];
        const hasDesigner = credits.some(
          (c: any) => c.role?.toLowerCase().includes("designer")
        );

        if (!hasDesigner) {
          credits.push({ role: "Designer", name: null });
          updateData.credits = credits;
          needsUpdate = true;
          console.log(`[${correlationId}] Auto-filled missing designer credit`);
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

      // Single transaction: update both ProjectPost and Project atomically
      const now = new Date();
      const [updated] = await prisma.$transaction([
        prisma.projectPost.update({
          where: { projectId },
          data: {
            status: targetStatus,
            slug,
            publishedAt: now,
          },
          select: {
            id: true,
            status: true,
            slug: true,
            publishedAt: true,
          },
        }),
        prisma.project.update({
          where: { id: projectId },
          data: {
            isPublic: true,
            publishedAt: now,
          },
        }),
      ]);

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

      // Editorial Queue three-story gate (async, non-blocking): if this publish
      // just earned the designer their queue, generate and notify.
      triggerQueueUnlockForProject(projectId).catch((err) => {
        console.error(`[${correlationId}] Editorial Queue unlock failed:`, err);
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

    // Handle unpublish: PUBLISHED -> DRAFT
    // Note: ProjectPost.publishedAt is PRESERVED (distinguishes UNPUBLISHED from GENERATED)
    //       Project.publishedAt is CLEARED (controls public visibility)
    if (targetStatus === "DRAFT" && post.status === "PUBLISHED") {
      // Unpublish is a publish-state change — gate by publish capability
      // so a Member can't yank a published project off the site.
      try {
        await assertProjectPublish(session.user.id, projectId);
      } catch {
        return NextResponse.json(
          { error: "Forbidden", message: "You do not have permission to unpublish this project." },
          { status: 403 }
        );
      }
      const [updated] = await prisma.$transaction([
        prisma.projectPost.update({
          where: { projectId },
          data: { status: "DRAFT" },
          select: { id: true, status: true, slug: true, publishedAt: true },
        }),
        prisma.project.update({
          where: { id: projectId },
          data: { isPublic: false, publishedAt: null },
        }),
      ]);

      try {
        const { logPassiveEvent } = await import("@/lib/analytics");
        await logPassiveEvent({
          projectId,
          type: "project_unpublish_success",
          actorId: session.user.id,
          payload: { postId: post.id },
        });
      } catch (analyticsError) {
        console.warn(`[${correlationId}] Analytics logging failed:`, analyticsError);
      }

      try {
        revalidatePath(`/p/${updated.slug}`);
        revalidatePath(`/project/${projectId}`);
        revalidatePath(`/designer/projects/${projectId}/preview`);
        revalidatePath(`/designer/projects/${projectId}`);
      } catch (revalidateError) {
        console.warn(`[${correlationId}] Revalidation failed:`, revalidateError);
      }

      console.log(`[${correlationId}] Unpublished successfully:`, { slug: updated.slug, status: updated.status });

      return NextResponse.json(
        { ok: true, slug: updated.slug, status: updated.status },
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
