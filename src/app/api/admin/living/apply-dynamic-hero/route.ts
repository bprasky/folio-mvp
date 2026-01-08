export const dynamic = 'force-dynamic';

// src/app/api/admin/living/apply-dynamic-hero/route.ts
//
// Admin endpoint to apply dynamic hero asset for a project

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { applyDynamicHeroForProject } from '@/lib/living/applyDynamicHero';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check admin role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Apply dynamic hero
    await applyDynamicHeroForProject(projectId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[POST /api/admin/living/apply-dynamic-hero] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply dynamic hero' },
      { status: 500 }
    );
  }
}








