import { deleteProjectWithSpotlightGuard } from '@/lib/spotlight/deletion';
import { SpotlightConflict } from '@/lib/spotlight/gate';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { prisma } from '@/lib/prisma';
import { logPassiveEvent } from '@/lib/analytics';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { normalizeRole } from '@/lib/permissions';
import { canCreateFirmProject } from '@/lib/orgPermissions';
import { z } from 'zod';
import { CanonicalCreateSchema, CompletionDateSchema, normalizeCreatePayload } from './normalizeCreatePayload';
import { logDbEnv } from '@/lib/dbEnv';
import { assertProjectWrite, assertProjectDelete } from "@/lib/authz/access";
import { CLIENT_BY_LABEL, PROJECT_TYPE_BY_LABEL, DEFAULTS } from '@/domain/project/enums';
import { makeSlug } from '@/lib/posting/slug';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';

const isDev = process.env.NODE_ENV !== 'production';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const designerId = url.searchParams.get('designerId');
    const mine = url.searchParams.get('mine') === 'true';
    const includeDrafts = url.searchParams.get('includeDrafts') === 'true';

    const whereClause: any = {};

    if (mine) {
      // Fetch current user's own projects (includes drafts)
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      whereClause.designerId = session.user.id;
    } else {
      // Filter projects by designer if specified
      if (designerId) {
        whereClause.designerId = designerId;
      }

      // Public/non-owner listing: only surface published projects. This guards
      // unpublished 'active' projects (e.g. "In progress" timeline) from leaking,
      // since draft is no longer the only private status. `includeDrafts` keeps the
      // legacy opt-in that returns everything (drafts + active + published).
      if (!includeDrafts) {
        Object.assign(whereClause, PUBLISHED_PROJECT_FILTER);
      }
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
    if (error instanceof SpotlightConflict) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
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

    // Authorize the target firm after resolving the requested workspace.
    let json: any;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Extract designerOrgId before normalization (not part of schema)
    let requestedOrgId = json?.designerOrgId as string | undefined;

    // Fallback: read operatingAsOrgId from user record if not in body
    if (!requestedOrgId) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { operatingAsOrgId: true },
      });
      if (userRecord?.operatingAsOrgId) {
        requestedOrgId = userRecord.operatingAsOrgId;
      }
    }

    // If designerOrgId provided, validate user is a member of that org
    let validatedOrgId: string | null = null;
    if (requestedOrgId) {
      const membership = await prisma.organizationUser.findFirst({
        where: { userId, organizationId: requestedOrgId, isActive: true },
        select: { id: true, role: true, organization: { select: { type: true } } },
      });
      if (!membership || !canCreateFirmProject(membership.role, membership.organization.type)) {
        return NextResponse.json({
          error: 'You need active project access to this firm.', nextPath: '/auth/org-setup'
        }, { status: 403 });
      }
      validatedOrgId = requestedOrgId;
    }

    // Require org context — no orphan projects
    if (!validatedOrgId) {
      return NextResponse.json({
        error: 'Connect your firm before creating a project.', nextPath: '/auth/org-setup'
      }, { status: 403 });
    }

    const data = normalizeCreatePayload(json); // accepts both shapes, returns canonical

    if (isDev) {
      console.log('[create-project] normalized data:', data, 'orgId:', validatedOrgId);
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
        timeline: data.timeline ?? null,
        completedYear: data.completedYear ?? null,
        completedMonth: data.completedMonth ?? null,
        designerId: userId,
        ownerId: userId,
        designerOrgId: validatedOrgId,
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

const ProjectUpdateSchema = z.object({
  id: z.string().min(1),
  title: CanonicalCreateSchema.shape.title.optional(),
  name: z.string().min(1).optional(),
  description: CanonicalCreateSchema.shape.description,
  stage: CanonicalCreateSchema.shape.stage.unwrap().optional(),
  projectType: CanonicalCreateSchema.shape.projectType.unwrap().optional(),
  clientType: CanonicalCreateSchema.shape.clientType.unwrap().optional(),
  budgetBand: CanonicalCreateSchema.shape.budgetBand.unwrap().optional(),
  city: CanonicalCreateSchema.shape.city,
  regionState: CanonicalCreateSchema.shape.regionState,
  completedYear: CanonicalCreateSchema.shape.completedYear,
  completedMonth: CanonicalCreateSchema.shape.completedMonth,
  credits: CanonicalCreateSchema.shape.credits,
  client: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectData = ProjectUpdateSchema.parse(await request.json());

    const { id, credits, ...updateData } = projectData;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for updates' },
        { status: 400 }
      );
    }
    
    await assertProjectWrite(session.user.id, id);

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

    if ('completedYear' in normalizedData || 'completedMonth' in normalizedData) {
      const current = await prisma.project.findUnique({
        where: { id },
        select: { completedYear: true, completedMonth: true },
      });
      if (!current) throw new Error('NotFound');
      const completionDate = CompletionDateSchema.safeParse({
        completedYear: 'completedYear' in normalizedData ? normalizedData.completedYear : current.completedYear,
        completedMonth: 'completedMonth' in normalizedData ? normalizedData.completedMonth : current.completedMonth,
      });
      if (!completionDate.success) {
        return NextResponse.json({
          error: 'ValidationError',
          issues: completionDate.error.flatten(),
          message: 'Invalid completion date',
        }, { status: 422 });
      }
      // Persist the validated pair together, including an explicitly unknown month.
      Object.assign(filteredData, completionDate.data);
    }

    const updatedProject = await prisma.$transaction(async tx => {
      const updatedProject = await tx.project.update({
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
    
      if (credits !== undefined) {
        await tx.projectPost.upsert({
          where: { projectId: id },
          create: { projectId: id, slug: makeSlug(updatedProject.title || undefined, id), status: 'DRAFT', credits },
          update: { credits },
        });
      }
      return updatedProject;
    });

    return NextResponse.json(updatedProject, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (error instanceof SpotlightConflict) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'NotFound') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
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
    
    await assertProjectDelete(session.user.id, id);

    await deleteProjectWithSpotlightGuard(id);
    
    return NextResponse.json({ message: 'Project deleted successfully', deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message === "NotFound") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (error instanceof SpotlightConflict) return NextResponse.json({ code: error.code, error: error.message }, { status: error.status });
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
