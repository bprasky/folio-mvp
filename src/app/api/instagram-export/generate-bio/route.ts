export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { generateBioBlurbs } from '@/lib/instagram-export/generate-bio';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, designerId, feedback } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Fetch project with post and designer
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        post: true,
        designer: {
          include: { brandProfile: true },
        },
      },
    });

    if (!project || !project.post || project.post.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Published project not found' }, { status: 404 });
    }

    // Auth: must be the project owner/designer
    if (project.designerId !== session.user.id && project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const designer = project.designer;
    if (!designer) {
      return NextResponse.json({ error: 'Designer not found' }, { status: 404 });
    }

    // Get atelier fingerprint for style info
    const fingerprint = await prisma.atelierFingerprint.findFirst({
      where: { designerId: designer.id },
      include: { nodes: true },
    });

    const styleName = fingerprint?.nodes?.find((n) => n.nodeType === 'STYLE')?.label;

    const bios = await generateBioBlurbs({
      designerName: designer.name,
      studio: designer.studio,
      companyName: designer.companyName,
      title: designer.title,
      bio: designer.bio,
      specialties: designer.specialties,
      styleName: styleName || null,
      styleDescription: null,
      postTitle: project.title,
      expandedBlocks: project.post.expandedBlocks,
      feedback,
    });

    return NextResponse.json({ bios });
  } catch (error: any) {
    console.error('[instagram-export/generate-bio]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate bio' },
      { status: 500 }
    );
  }
}
