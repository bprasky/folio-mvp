import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabaseServer';
import { parseFinishSchedule } from '@/lib/import-agent/parseFinishSchedule';
import { finishScheduleToPendingTags } from '@/lib/import-agent/finishScheduleToPendingTags';

// exceljs / papaparse need the Node runtime; give parsing a little headroom.
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/import/finish-schedule
 *
 * Parse an uploaded finish schedule (XLSX/CSV) into products and stage them as
 * reviewable PendingProductTag rows (source = SPEC) on a new ImportSession —
 * the same review queue the PDF spec importer feeds. The client then reviews
 * and finalizes them. Mirrors /api/projects/[id]/import-spec.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Verify user owns the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { designerId: userId },
        ],
      },
      include: {
        images: {
          select: {
            id: true,
            url: true,
            room: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Create import session
    const importSession = await prisma.importSession.create({
      data: {
        userId,
        sourceType: 'PRESENTATION',
        projectId,
        status: 'PROCESSING',
      },
    });

    // Upload file to Supabase storage
    const fileBuffer = await file.arrayBuffer();
    const fileName = `finish-schedules/${projectId}/${importSession.id}/${file.name}`;

    const { data: uploadData, error: uploadError } = await supabaseServer.storage
      .from('imports')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Continue anyway - we can process without storing
    }

    // Get the file URL if uploaded successfully
    let fileUrl: string | null = null;
    if (uploadData) {
      const { data: urlData } = supabaseServer.storage
        .from('imports')
        .getPublicUrl(fileName);
      fileUrl = urlData?.publicUrl || null;
    }

    // Parse the finish schedule into products and stage them as reviewable
    // PendingProductTag rows (source = SPEC), the same queue import-spec feeds.
    let tagCount = 0;
    let rows: Awaited<ReturnType<typeof parseFinishSchedule>> = [];
    try {
      rows = await parseFinishSchedule(Buffer.from(fileBuffer), file.name);
      tagCount = await finishScheduleToPendingTags(importSession.id, rows);
    } catch (parseErr: any) {
      console.error('[finish-schedule] parse failed:', parseErr?.message);
      await prisma.importSession.update({
        where: { id: importSession.id },
        data: {
          status: 'FAILED',
          errorMessage: parseErr?.message || 'We couldn’t read products from that file.',
        },
      });
      return NextResponse.json(
        { error: parseErr?.message || 'We couldn’t read products from that finish schedule.' },
        { status: 422 },
      );
    }

    await prisma.importSession.update({
      where: { id: importSession.id },
      data: {
        status: tagCount > 0 ? 'READY_FOR_REVIEW' : 'FAILED',
        errorMessage:
          tagCount > 0
            ? null
            : 'No product rows were found. Make sure the file has a header row (e.g. Product, Brand, Price).',
        completedAt: tagCount > 0 ? null : new Date(),
      },
    });

    if (tagCount === 0) {
      return NextResponse.json(
        {
          error:
            'No product rows were found. Make sure the file has a header row with columns like Product, Brand, and Price.',
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        sessionId: importSession.id,
        status: 'READY_FOR_REVIEW',
        fileUrl,
        projectId,
        tagCount,
        imageCount: project.images.length,
        // A lightweight preview so the client can confirm the file was read.
        products: rows.slice(0, 200).map((r) => ({
          name: r.name,
          brand: r.brand,
          room: r.room,
          price: r.price,
        })),
      },
      { status: 201 },
    );

  } catch (error) {
    console.error('Error processing finish schedule:', error);
    return NextResponse.json(
      { error: 'Failed to process finish schedule' },
      { status: 500 }
    );
  }
}
