import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { prisma } from '@/lib/prisma';
import { logPassiveEvent } from '@/lib/analytics';

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
  const supabase = supabaseServer();

  // 1) Supabase via cookies
  let { data: { user } } = await supabase.auth.getUser();

  // 2) Optional: Bearer fallback strictly when allowed
  if (!user && process.env.NEXT_PUBLIC_ALLOW_BEARER_FALLBACK === 'true') {
    const auth = req.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const res = await supabase.auth.getUser(token);
      user = res.data?.user ?? null;
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', hint: 'No Supabase cookie; enable NEXT_PUBLIC_ALLOW_BEARER_FALLBACK or use dev Supabase sign-in.' }, { status: 401 });
  }

  const profile = await prisma.user.findUnique({ where: { id: user.id } });
  if (!profile || profile.role !== 'DESIGNER') {
    return NextResponse.json({ error: 'Forbidden: designer only' }, { status: 403 });
  }

  try {
    const { name, description, detailsCore } = await req.json().catch(() => ({}));
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const core = detailsCore ?? null;
    const hasCore = !!(core && core.projectType && core.stage && core.clientType && core.location && core.budgetBand);

    const baseData: any = {
      name: name.trim(),
      description: (description ?? '').trim() || null,
      designerId: profile.id,
      ownerId: profile.id,
    };

    const createWithJsonField = async (jsonField: 'details'|'meta') => {
      const data = { ...baseData, [jsonField]: hasCore ? { core } : undefined };
      return prisma.project.create({ data, select: { id: true } });
    };

    let project;
    try {
      // Try "details" first
      project = await createWithJsonField('details');
    } catch (e1: any) {
      const msg = String(e1?.message || '');
      if (!/Unknown argument `details`/i.test(msg)) throw e1; // not a schema issue → rethrow

      // Try "meta"
      try {
        project = await createWithJsonField('meta');
      } catch (e2: any) {
        const msg2 = String(e2?.message || '');
        if (!/Unknown argument `meta`/i.test(msg2)) throw e2;

        // Fallback: encode JSON in description front-matter (no schema change)
        const jsonLine = hasCore ? `---JSON---${JSON.stringify({ core })}\n` : '';
        const desc = (baseData.description ?? '');
        project = await prisma.project.create({
          data: { ...baseData, description: `${jsonLine}${desc}`.trim() || null },
          select: { id: true },
        });
      }
    }

    // Log analytics event
    try {
      await logPassiveEvent({
        projectId: project.id,
        type: 'project_create',
        actorId: user.id,
        payload: { source: 'designer_create_page' }
      });
    } catch (analyticsError) {
      console.warn('Analytics logging failed:', analyticsError);
      // Don't fail the request for analytics errors
    }

    return NextResponse.json({ id: project.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const projectData = await request.json();
    
    const { id, ...updateData } = projectData;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for updates' },
        { status: 400 }
      );
    }

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
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required for deletion' },
        { status: 400 }
      );
    }

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