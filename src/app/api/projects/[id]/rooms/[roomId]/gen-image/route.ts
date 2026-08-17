export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertProjectAccess, getUserOrgMemberships, canGenerateImages as canGenerateImagesWithMembership } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { buildBasePrompt, mergeModifiers } from '@/lib/boards/prompt';
import { getImageGenProvider } from '@/lib/ai/imageGen';
import { saveBufferToProjectStorage } from '@/lib/storage';
import { logPassiveEvent } from '@/lib/analytics';
import { resolveSelectionToProduct } from '@/lib/tagging/resolveSelectionToProduct';
import { proposedFinishByProductId } from '@/lib/products/proposedFinish';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; roomId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.warn("[gen-image][401] No session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: projectId, roomId } = params;

    const access = await assertProjectAccess({ projectId, userId, role: session.user.role });
    if (!access.ok) {
      console.warn("[gen-image][access]", access);
      return NextResponse.json({ error: access.reason }, { status: access.status });
    }

    // Permission check: Image generation requires a professional org project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        designerOrgId: true,
        designerOrg: {
          select: {
            id: true,
            status: true,
          }
        }
      }
    });

    // Check if this is an org project with professional status
    if (!project?.designerOrgId || !project.designerOrg) {
      console.warn("[gen-image][permissions] Image generation not available for personal projects");
      return NextResponse.json(
        { error: "Image generation is only available for organization projects. Please upgrade to a professional plan." },
        { status: 403 }
      );
    }

    // Check if the org is professional
    if (project.designerOrg.status !== 'PROFESSIONAL') {
      console.warn("[gen-image][permissions] Image generation requires professional org status");
      return NextResponse.json(
        { error: "Image generation requires a professional organization subscription." },
        { status: 403 }
      );
    }

    // Verify user belongs to this org with proper membership
    const memberships = await getUserOrgMemberships(userId);
    const hasOrgMembership = memberships.some(m => m.organizationId === project.designerOrgId);

    if (!hasOrgMembership) {
      console.warn("[gen-image][permissions] User not a member of project's organization");
      return NextResponse.json(
        { error: "You must be a member of the project's organization to generate images." },
        { status: 403 }
      );
    }

    // Rate limiting
    const maxPerHour = parseInt(process.env.IMAGE_GEN_MAX_PER_HOUR || '10');
    const rateLimitResult = rateLimit({
      userId,
      scope: 'gen-image',
      limit: maxPerHour,
      windowMs: 60 * 60 * 1000, // 1 hour
    });
    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { modifiers = "", n = 2, width = 1024, height = 1024, seed } = body;

    // Validate inputs
    if (n < 1 || n > 4) {
      return NextResponse.json(
        { error: 'Number of images must be between 1 and 4' },
        { status: 400 }
      );
    }

    if (width < 256 || width > 2048 || height < 256 || height > 2048) {
      return NextResponse.json(
        { error: 'Image dimensions must be between 256x256 and 2048x2048' },
        { status: 400 }
      );
    }

    const { base, context, selectionIds } = await buildBasePrompt({ projectId, roomId });
    const prompt = mergeModifiers(base, modifiers);

    // Fetch selection photos for reference images (Flux/Replicate support)
    const selections = await prisma.selection.findMany({
      where: {
        id: { in: selectionIds },
        photo: { not: null },
      },
      select: { photo: true },
      take: 10, // Flux Kontext supports up to 10 reference images
    });
    const referenceImages = selections
      .map(s => s.photo)
      .filter((url): url is string => !!url && url.startsWith('http'));

    console.log(`[gen-image] Found ${referenceImages.length} reference images from ${selectionIds.length} selections`);

    const provider = getImageGenProvider();
    let out = await provider.generate({ prompt, n, width, height, seed, referenceImages });
    
    // Retry once if no images returned
    if (!out.images?.length) {
      console.warn("[gen-image] Empty result; retrying once");
      out = await provider.generate({ prompt, n, width, height, seed, referenceImages });
    }
    
    if (!out.images?.length) {
      console.error("[gen-image] OpenAI returned no images after retry");
      return NextResponse.json({ error: "Image service returned no images" }, { status: 502 });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, name: true },
    });

    const saved = [];
    for (const img of out.images) {
      const { path, publicUrl } = await saveBufferToProjectStorage({
        projectId,
        roomId,
        buffer: img.buffer,
        mime: img.mime,
      });

      // Persist to database for GET route compatibility
      const metadata = {
        type: 'GENERATED',
        provider: (out.meta?.provider ?? "unknown").toString(),
        promptBase: base,
        promptModifiers: modifiers,
        promptFull: prompt,
        selectionIds,
        contextJSON: { ...(context ?? {}), roomName: room?.name ?? null },
        width,
        height,
        seed: seed ?? null,
        generatedBy: userId,
        generatedAt: new Date().toISOString()
      };

      const rec = await prisma.projectImage.create({
        data: {
          url: publicUrl,
          name: JSON.stringify(metadata), // Store metadata in name field for GET route filtering
          room: roomId,
          projectId,
        },
        select: { id: true, url: true },
      }).catch(async () => null);

      // Auto-tag: create ProductTags from selections used in this generated image
      if (rec?.id && selectionIds.length > 0) {
        try {
          // Fetch selections that don't already have a productTagId
          const selsToTag = await prisma.selection.findMany({
            where: { id: { in: selectionIds }, productTagId: null },
            select: { id: true, productName: true, vendorName: true },
          });

          // Resolve each selection to a Product
          const resolved: Array<{ selectionId: string; productId: string }> = [];
          for (const sel of selsToTag) {
            const match = await resolveSelectionToProduct(sel);
            if (match) resolved.push({ selectionId: sel.id, productId: match.productId });
          }

          if (resolved.length > 0) {
            // Compute grid positions for tags
            const padding = 15;
            const span = 100 - 2 * padding;
            const positions = resolved.map((_, i) => ({
              x: resolved.length === 1 ? 50 : Math.round((padding + (span * i) / (resolved.length - 1)) * 100) / 100,
              y: 50,
            }));

            // PROPOSE site (spec 21 delta D3). A generated-image tag takes
            // extraction's finish with finishConfirmed false. Resolved in one
            // batch before the transaction so the tag writes stay a single round
            // of inserts rather than interleaving lookups.
            const proposedFinishes = await proposedFinishByProductId(
              resolved.map((r) => r.productId),
            );

            // Create tags + backlinks in a transaction
            await prisma.$transaction(async (tx) => {
              for (let i = 0; i < resolved.length; i++) {
                const tag = await tx.productTag.create({
                  data: {
                    x: positions[i].x,
                    y: positions[i].y,
                    productId: resolved[i].productId,
                    imageId: rec.id,
                    finishRaw: proposedFinishes.get(resolved[i].productId) ?? null,
                    finishConfirmed: false,
                  },
                });
                await tx.selection.update({
                  where: { id: resolved[i].selectionId },
                  data: { productTagId: tag.id },
                });
              }
            });

            console.log(`[gen-image][auto-tag] Created ${resolved.length} tags for image ${rec.id}`);
          }
        } catch (tagErr) {
          // Don't fail image generation if auto-tagging fails
          console.warn('[gen-image][auto-tag] Failed:', tagErr);
        }
      }

      // Return both DB record and storage info
      saved.push({
        id: rec?.id ?? path,
        url: publicUrl,
        width: width ?? 1024,
        height: height ?? 1024,
        provider: out.meta?.provider ?? "openai",
        metadata: { context: { ...(context ?? {}), roomName: room?.name ?? null } },
      });
    }

    if (!saved.length) {
      return NextResponse.json({ error: "Failed to store generated images" }, { status: 500 });
    }

    // Log analytics event
    try {
      await logPassiveEvent({
        projectId,
        type: 'project_create', // Reusing existing type, could add 'image_generated'
        actorId: userId,
        payload: {
          event: 'boards.image.generated',
          roomId,
          count: saved.length,
          provider: out.meta?.provider,
          hasModifiers: !!modifiers
        }
      });
    } catch (analyticsError) {
      console.warn('Analytics logging failed:', analyticsError);
      // Don't fail the request for analytics errors
    }

    return NextResponse.json({ ok: true, assets: saved });
  } catch (err: any) {
    const status = err?.status === 429 ? 429 : 500;
    console.error("[gen-image][error]", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status });
  }
}
