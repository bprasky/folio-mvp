export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import {
  generateAllSlides,
  type ExportConfig,
  type AspectRatio,
} from '@/lib/instagram-export/generate-images';
import type { HeadlinePosition, WatermarkStyle } from '@/lib/instagram-export/svg-templates';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, config } = body;

    if (!projectId || !config) {
      return NextResponse.json(
        { error: 'projectId and config are required' },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        post: true,
        designer: true,
        images: { orderBy: { displayOrder: 'asc' } },
      },
    });

    if (!project || !project.post || project.post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Published project not found' }, { status: 404 });
    }

    if (project.designerId !== session.user.id && project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const designer = project.designer;

    const exportConfig: ExportConfig = {
      aspectRatio: (config.aspectRatio || '4:5') as AspectRatio,
      watermarkStyle: (config.watermarkStyle || 'folio_x') as WatermarkStyle,
      headlinePosition: (config.headlinePosition || 'bottom_left') as HeadlinePosition,
      headline: config.headline || project.title,
      designerName: designer?.name || 'Designer',
      designerTitle: designer?.title || undefined,
      studioName: designer?.studio || designer?.companyName || undefined,
      bioEnabled: config.bioEnabled ?? true,
      bioText: config.bioText,
      projectName: project.title,
      slideCount: config.slideCount || 5,
      selectedImageUrls: config.selectedImageUrls || project.images.map((img) => img.url),
      roomId: config.roomId,
    };

    const slides = await generateAllSlides(exportConfig, designer?.profileImage || undefined);

    // Return images as base64-encoded data URLs for client-side download
    const images = slides.map((slide) => ({
      slideIndex: slide.slideIndex,
      type: slide.type,
      dataUrl: `data:image/jpeg;base64,${slide.buffer.toString('base64')}`,
    }));

    // Save export record
    await prisma.instagramExport.create({
      data: {
        projectId,
        designerId: session.user.id,
        config: exportConfig as any,
        headline: exportConfig.headline,
        bioText: exportConfig.bioText,
        status: 'generated',
      },
    });

    return NextResponse.json({ images });
  } catch (error: any) {
    console.error('[instagram-export/generate-images]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate images' },
      { status: 500 }
    );
  }
}
