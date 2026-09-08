export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { assertProjectWrite } from '@/lib/authz/access';
import { prisma } from '@/lib/prisma';
import { canPublishFromOrg } from '@/lib/permissions';
import { transitionEditorial } from '@/lib/editorial/lifecycle';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { notifyTaggedVendors } from '@/lib/email/notifyVendorTagged';
import { triggerQueueUnlockForProject } from '@/lib/editorial-queue/unlock';

const Body = z.object({
  action: z.enum(['publish', 'unpublish', 'submit', 'approve', 'reject', 'archive']),
  reason: z.string().trim().min(1).max(2000).optional(),
  expectedUpdatedAt: z.iso.datetime().optional(),
}).strict().superRefine((body, context) => {
  if ((body.action === 'approve' || body.action === 'reject') && !body.expectedUpdatedAt) {
    context.addIssue({ code: 'custom', message: 'Review requires the post version', path: ['expectedUpdatedAt'] });
  }
});

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
    const { action } = parsed.data;
    // The service additionally checks the database ADMIN role before reading the post.
    if (action === 'approve' || action === 'reject') {
      if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      await assertProjectWrite(session.user.id, params.projectId);
    }
    if (action === 'publish') {
      const enabled = (process.env.POSTING_V1 ?? '').toLowerCase() === 'true' ||
        (process.env.NEXT_PUBLIC_POSTING_V1 ?? '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';
      // Preserve Path A's flag. Path B publishEditorial remains flag-independent;
      // unpublish also remains available when Posting V1 is disabled.
      if (!enabled) return NextResponse.json({ error: 'Posting V1 not enabled' }, { status: 404 });
      const project = await prisma.project.findUnique({ where: { id: params.projectId }, select: { designerOrgId: true } });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const gate = await canPublishFromOrg(session.user.id, project.designerOrgId);
      if (gate.ok === false) return NextResponse.json({ error: 'Forbidden', reason: gate.reason }, { status: 403 });
    }
    const post = await transitionEditorial({
      ...parsed.data, userId: session.user.id, projectId: params.projectId, postingV1: action === 'publish',
    });
    revalidatePath('/p/' + post.slug);
    revalidatePath('/project/' + params.projectId);
    revalidatePath('/designer/projects/' + params.projectId + '/preview');
    revalidatePath('/admin/editorial-review');
    if (post.changed && post.status === 'PUBLISHED') {
      notifyTaggedVendors({ projectId: params.projectId }).catch(err => console.error('[editorial] Vendor notification failed', err));
      triggerQueueUnlockForProject(params.projectId).catch(err => console.error('[editorial] Queue unlock failed', err));
    }
    return NextResponse.json({ ok: true, slug: post.slug, status: post.status, publishedAt: post.publishedAt });
  } catch (error: any) {
    const status = error.status ?? (error.message === 'Forbidden' ? 403 : error.message === 'NotFound' ? 404 : 500);
    if (status === 500) console.error('[editorial/status]', error);
    return NextResponse.json({ error: status === 500 ? 'Internal server error' : error.message }, { status });
  }
}
