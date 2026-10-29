import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { createWorkspaceImport, WorkspaceImportError } from '@/lib/workspace-import/store';

export const dynamic = 'force-dynamic';
const schema = z.object({ orgId: z.string().min(1).max(100), website: z.string().trim().min(3).max(2048),
  bioUrl: z.string().trim().max(2048).optional(), projectUrls: z.array(z.string().trim().min(1).max(2048)).max(10).optional(),
  sections: z.array(z.enum(['business', 'bio', 'projects'])).min(1).max(3),
  consent: z.literal(true, { error: 'Give permission before importing from your website.' }),
  requestId: z.string().uuid(), returnTo: z.string().max(2048).optional() });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Sign in to prepare your workspace.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  if (!process.env.CRON_SECRET || !process.env.RESEND_API_KEY)
    return Response.json({ error: 'Background imports are not available yet. You can still add your business details and projects manually.' }, { status: 503 });
  try {
    const id = await createWorkspaceImport(session.user.id, parsed.data);
    return Response.json({ id }, { status: 202 });
  } catch (error) {
    if (error instanceof WorkspaceImportError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'We couldn’t start this import. Check the website address and try again.' }, { status: 400 });
  }
}
