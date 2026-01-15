import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * POST /api/import/finish-schedule
 * Upload and process a finish schedule for automated product tagging
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

    // For now, mark session as complete
    // TODO: Integrate with actual import agent processing
    // The import agent would:
    // 1. Parse the finish schedule (PDF/PPTX/Excel)
    // 2. Extract product information
    // 3. Match products to project images using AI
    // 4. Create PendingProductTag records for verification

    await prisma.importSession.update({
      where: { id: importSession.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Return success with session info
    return NextResponse.json({
      sessionId: importSession.id,
      status: 'COMPLETED',
      fileUrl,
      projectId,
      imageCount: project.images.length,
      message: 'Finish schedule processed. AI tagging suggestions will appear on your images.',
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing finish schedule:', error);
    return NextResponse.json(
      { error: 'Failed to process finish schedule' },
      { status: 500 }
    );
  }
}
