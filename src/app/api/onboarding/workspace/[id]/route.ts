import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { readImportReview, reviewImport, reviewSchema } from '@/lib/workspace-import/review';
import { WorkspaceImportError } from '@/lib/workspace-import/store';

export const dynamic = 'force-dynamic';
const failure = (error: unknown) => Response.json({ error: error instanceof WorkspaceImportError ? error.message : 'Could not load or save your import. Please refresh and try again.' },
  { status: error instanceof WorkspaceImportError ? error.status : 500 });

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Sign in to view your import.' }, { status: 401 });
  try { return Response.json(await readImportReview(session.user.id, params.id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Sign in to review your import.' }, { status: 401 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    await reviewImport(session.user.id, params.id, parsed.data);
    return Response.json(await readImportReview(session.user.id, params.id));
  } catch (error) { return failure(error); }
}
