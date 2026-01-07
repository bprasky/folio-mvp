/**
 * API route to generate Instagram caption
 * POST /api/instagram/caption
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertProjectView } from '@/lib/authz/access';
import { generateCaption } from '@/lib/instagram/generateCaption';
import { z } from 'zod';

const CaptionRequestSchema = z.object({
  projectId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { projectId } = CaptionRequestSchema.parse(body);

    // Verify project access
    await assertProjectView(userId, projectId);

    // Fetch project data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        description: true,
        city: true,
        regionState: true,
        projectType: true,
        images: {
          include: {
            tags: {
              include: {
                product: {
                  select: {
                    name: true,
                    category: true,
                    brand: true,
                  },
                },
              },
            },
          },
        },
        post: {
          select: {
            expandedBlocks: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate caption
    const result = await generateCaption({
      projectTitle: project.title,
      projectDescription: project.description,
      city: project.city,
      regionState: project.regionState,
      projectType: project.projectType,
      expandedBlocks: project.post?.expandedBlocks as any,
      productTags: project.images.flatMap(img =>
        img.tags.map(tag => ({ product: tag.product }))
      ),
    });

    // Format caption with hashtags on new line
    const formattedCaption = result.caption + '\n\n' + result.hashtags.join(' ');
    
    return NextResponse.json({
      caption: formattedCaption,
      hashtags: result.hashtags,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request', issues: error.issues },
        { status: 400 }
      );
    }

    if (error.message === 'Forbidden' || error.message === 'NotFound') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('[instagram-caption] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate caption' },
      { status: 500 }
    );
  }
}

