export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { prisma } from '@/lib/prisma';
import { logPassiveEvent } from '@/lib/analytics';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole, canPerformAction } from '@/lib/permissions';
import { normalizeCreatePayload } from './normalizeCreatePayload';
import { logDbEnv } from '@/lib/dbEnv';
import { assertProjectView } from "@/lib/authz/access";
import { CLIENT_BY_LABEL, PROJECT_TYPE_BY_LABEL, DEFAULTS } from '@/domain/project/enums';
import { makeSlug } from '@/lib/posting/slug';

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
  try {
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

    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in' }, { status: 401 });
    }

    // Check org-based permission (user must be operating as a design firm)
    const canCreate = await canPerformAction(userId, 'create_project');
    if (!canCreate) {
      return NextResponse.json({
        error: 'You must be operating as a design firm to create projects'
      }, { status: 403 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data = normalizeCreatePayload(json); // accepts both shapes, returns canonical

    if (isDev) {
      console.log('[create-project] normalized data:', data);
    }

    // Map projectStatus to database status
    // new_project -> draft (work in progress)
    // completed_project -> active (ready to showcase)
    const dbStatus = data.projectStatus === 'completed_project' ? 'active' : 'draft';

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
        status: dbStatus,
        isPublic: false,
        publishedAt: null,
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
    }

    // Create ProjectPost with credits if provided
    if (data.credits && Array.isArray(data.credits) && data.credits.length > 0) {
      try {
        const slug = makeSlug(data.title || undefined, project.id);
        await prisma.projectPost.create({
          data: {
            projectId: project.id,
            slug,
            status: 'DRAFT',
            credits: data.credits,
          },
        });
        if (isDev) {
          console.log('[create-project] Created ProjectPost with credits');
        }
      } catch (postError) {
        console.warn('[create-project] Failed to create ProjectPost with credits:', postError);
        // Don't fail the whole request if ProjectPost creation fails
      }
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

    // Prisma or unknown → 500 with details
    console.error('[create-project] Error:', e);
    return NextResponse.json(
      {
        error: 'CreateFailed',
        code: e?.code ?? null,
        meta: e?.meta ?? null,
        message: e?.message ?? 'Unknown error',
      },
      { status: 500 }
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

    const { id, images, status, isDraft, designerId, credits, ...updateData } = projectData;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for updates' },
        { status: 400 }
      );
    }
    
    const access = await assertProjectView(session.user.id, id);

    // Normalize legacy fields if present (for backward compatibility)
    const normalizedData: any = { ...updateData };
    
    // Map 'name' to 'title' if present
    if (normalizedData.name && !normalizedData.title) {
      normalizedData.title = normalizedData.name;
      delete normalizedData.name;
    }

    // Map 'client' to 'clientType' if present
    if (normalizedData.client && !normalizedData.clientType) {
      normalizedData.clientType = CLIENT_BY_LABEL.get(normalizedData.client.toLowerCase()) ?? DEFAULTS.clientType;
      delete normalizedData.client;
    }

    // Map 'category' to 'projectType' if present
    if (normalizedData.category && !normalizedData.projectType) {
      normalizedData.projectType = PROJECT_TYPE_BY_LABEL.get(normalizedData.category.toLowerCase()) ?? DEFAULTS.projectType;
      delete normalizedData.category;
    }

    // Filter out invalid fields (images should be handled separately)
    // Don't allow status updates via this endpoint (use posting layer)
    // Don't allow designerId updates (use participants)
    const allowedFields = ['title', 'description', 'stage', 'projectType', 'clientType', 'budgetBand', 'city', 'regionState'];
    const filteredData: any = {};
    for (const key of allowedFields) {
      if (key in normalizedData) {
        filteredData[key] = normalizedData[key];
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...filteredData,
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

    // Handle credits update - upsert ProjectPost with credits
    if (credits && Array.isArray(credits)) {
      try {
        const existingPost = await prisma.projectPost.findUnique({
          where: { projectId: id },
        });

        if (existingPost) {
          // Update existing ProjectPost with new credits
          await prisma.projectPost.update({
            where: { projectId: id },
            data: {
              credits: credits,
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new ProjectPost with credits
          const slug = makeSlug(updatedProject.title || undefined, id);
          await prisma.projectPost.create({
            data: {
              projectId: id,
              slug,
              status: 'DRAFT',
              credits: credits,
            },
          });
        }
        console.log('ProjectPost credits updated successfully');
      } catch (postError) {
        console.warn('Failed to update ProjectPost credits:', postError);
        // Don't fail the whole request if credits update fails
      }
    }

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