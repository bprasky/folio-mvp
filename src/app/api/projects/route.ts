import { createProjectOnce, CreationConflict } from '@/lib/projects/createProject';
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
import { publicProject } from '@/lib/post/publicPost';
import { PUBLISHED_PROJECT_FILTER } from '@/server/queries/filters';

const isDev = process.env.NODE_ENV !== 'production';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const designerId = url.searchParams.get('designerId');
    const mine = url.searchParams.get('mine') === 'true';
    const includeDrafts = url.searchParams.get('includeDrafts') === 'true';

    const whereClause: any = {};

    if (mine || includeDrafts) {
      // Draft access is authenticated and scoped; a query parameter is never
      // permission to read another designer's unpublished work.
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (mine) {
        whereClause.designerId = session.user.id;
      } else {
        const actor = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { role: true },
        });
        if (normalizeRole(actor?.role) === 'ADMIN') {
          if (designerId) whereClause.designerId = designerId;
        } else {
          if (designerId && designerId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
          whereClause.designerId = session.user.id;
        }
      }
    } else {
      // Filter projects by designer if specified
      if (designerId) {
        whereClause.designerId = designerId;
      }

      // Public listings always retain the canonical publication filter.
      Object.assign(whereClause, PUBLISHED_PROJECT_FILTER);
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
    
    return NextResponse.json(mine || includeDrafts ? projects : projects.map(publicProject));
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

    const requestId = json?.requestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
      return NextResponse.json({ error: 'A stable creation request ID is required. Reload this form and try again.' }, { status: 428 });
    }
    const project = await createProjectOnce(userId, validatedOrgId, requestId, json);

    // Log analytics event
    try {
      if (!project.replayed) await logPassiveEvent({
        projectId: project.id,
        type: 'project_create',
        actorId: userId,
        payload: { source: 'designer_create_page' }
      });
    } catch (analyticsError) {
      console.warn('Analytics logging failed:', analyticsError);
    }

    return NextResponse.json({ id: project.id }, { status: project.replayed ? 200 : 201 });
  } catch (e: any) {
    if (e instanceof CreationConflict) return NextResponse.json({ error: e.message, id: e.id }, { status: 409 });
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
        message: 'Could not save this project. Your details have not been discarded; retry the same request.',
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

