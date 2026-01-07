import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertProjectAccess } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimit';
import { buildBasePrompt, mergeModifiers } from '@/lib/boards/prompt';
import { getImageGenProvider } from '@/lib/ai/imageGen';
import { saveBufferToProjectStorage } from '@/lib/storage';
import { logPassiveEvent } from '@/lib/analytics';

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

    // Rate limiting
    const limitKey = `gen-image:${userId}`;
    const maxPerHour = parseInt(process.env.IMAGE_GEN_MAX_PER_HOUR || '10');
    try {
      rateLimit(limitKey, maxPerHour, 60 * 60 * 1000); // 1 hour window
    } catch (rateLimitError: any) {
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

    const provider = getImageGenProvider();
    let out = await provider.generate({ prompt, n, width, height, seed });
    
    // Retry once if no images returned
    if (!out.images?.length) {
      console.warn("[gen-image] Empty result; retrying once");
      out = await provider.generate({ prompt, n, width, height, seed });
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
