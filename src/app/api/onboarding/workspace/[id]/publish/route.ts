import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { readImportPublication, publishImport } from '@/lib/workspace-import/publish';
import { WorkspaceImportError } from '@/lib/workspace-import/store';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'private, no-store' };
const failure = (error: unknown) => Response.json({ error: error instanceof WorkspaceImportError ? error.message : error instanceof z.ZodError ? 'Review your selected photographs.' : 'Could not confirm publication. Reload the review to see which projects are live.' },
  { status: error instanceof WorkspaceImportError ? error.status : error instanceof z.ZodError ? 400 : 500, headers });
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Sign in to review your photographs.' }, { status: 401, headers });
  try { return Response.json(await readImportPublication(session.user.id, params.id), { headers }); } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Publish from Folio.' }, { status: 403, headers });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: 'Sign in to publish your photographs.' }, { status: 401, headers });
  try {
    const result = await publishImport(session.user.id, params.id, await request.json());
    for (const item of result.results) if (item.published) revalidatePath(`/project/${item.projectId}`);
    revalidatePath(result.profileHref); revalidatePath('/profile', 'layout'); revalidatePath('/projects'); revalidatePath('/designer');
    return Response.json(result, { headers });
  } catch (error) { return failure(error); }
}
