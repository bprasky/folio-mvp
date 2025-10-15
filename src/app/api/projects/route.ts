import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { prisma } from '@/lib/prisma';
import { logPassiveEvent } from '@/lib/analytics';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canCreateProject } from '@/lib/permissions';
import { normalizeCreatePayload } from './normalizeCreatePayload';
import { logDbEnv } from '@/lib/dbEnv';
import { assertProjectView } from "@/lib/authz/access";

const isDev = process.env.NODE_ENV !== 'production';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const designerId = url.searchParams.get('designerId');
    const includeDrafts = url.searchParams.get('includeDrafts') === 'true';
    
    const whereClause: any = {};
    
    // Filter projects by designer if specified
    if (designerId) {
      whereClause.designerId = designerId;
    }
    
    // Filter out drafts unless specifically requested
    if (!includeDrafts) {
      whereClause.status = { not: 'draft' };
    }
    
    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        designer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        images: {
          include: {
            tags: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  logDbEnv('create-project'); // shows which DB this code is writing to
  
  if (isDev) {
    console.log('[create-project] cookie?', !!req.headers.get('cookie'));
  }
  
  const session = await getServerSession(authOptions);
  const role = normalizeRole(session?.user?.role);
  const userId = (session?.user as any)?.id as string | undefined;

  if (isDev) {
    console.log('[create-project] session', { email: session?.user?.email, role, userId });
  }

  if (isDev) {
    console.log('[create-project]', { 
      hasCookie: !!req.headers.get('cookie'), 
      email: session?.user?.email, 
      role, 
      userId 
    });
  }

  if (!userId) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 });
  }

  if (!canCreateProject(role)) {
    return NextResponse.json({ error: 'Your role is not permitted to create projects' }, { status: 403 });
  }

  let json: unknown;
  try { 
    json = await req.json(); 
  } catch { 
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); 
  }

  try {
    const data = normalizeCreatePayload(json); // accepts both shapes, returns canonical
    
    if (isDev) {
      console.log('[create-project] normalized data:', data);
    }

    const project = await prisma.project.create({
      data: {
        title: data.title,
        stage: data.stage,
        projectType: data.projectType,
        clientType: data.clientType,
        budgetBand: data.budgetBand,
        city: data.city ?? null,
        regionState: data.regionState ?? null,
        description: data.description ?? null,
        designerId: userId,
        ownerId: userId,
        status: 'draft',
        isPublic: false,
        isAIEnabled: false,
        views: 0,
        saves: 0,
        shares: 0,
      },
      select: { id: true },
    });

    // Log analytics event
    try {
      await logPassiveEvent({
        projectId: project.id,
        type: 'project_create',
        actorId: userId,
        payload: { source: 'designer_create_page' }
      });
    } catch (analyticsError) {
      console.warn('Analytics logging failed:', analyticsError);
      // Don't fail the request for analytics errors
    }

    return NextResponse.json({ id: project.id }, { status: 201 });
  } catch (e: any) {
    // ZodError → 422
    if (e?.name === 'ZodError') {
      if (isDev) {
        console.warn('[create-project] Zod issues:', e.issues ?? e);
      }
      return NextResponse.json({ 
        error: 'ValidationError', 
        issues: e.flatten?.() ?? e,
        message: 'Invalid project data'
      }, { status: 422 });
    }
    
    // Prisma or unknown → 400 with details
    if (isDev) console.error('[create-project] Error:', e);
    return NextResponse.json(
      { 
        error: 'CreateFailed', 
        code: e?.code ?? null, 
        meta: e?.meta ?? null, 
        message: e?.message ?? 'Unknown error',
        detail: 'Database operation failed'
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const projectData = await request.json();
    
    const { id, ...updateData } = projectData;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for updates' },
        { status: 400 }
      );
    }
    
    const access = await assertProjectView(session.user.id, id);

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        images: {
          include: {
            tags: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
    
    console.log('Project updated successfully:', updatedProject);
    
    return NextResponse.json(updatedProject, { status: 200 });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for deletion' },
        { status: 400 }
      );
    }
    
    const access = await assertProjectView(session.user.id, id);

    await prisma.project.delete({
      where: { id },
    });
    
    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
} 