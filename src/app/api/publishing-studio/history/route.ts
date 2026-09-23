import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { canAccessDesignerTools } from '@/lib/permissions';
import { getStudioData, StudioAccessError } from '@/lib/publishing-studio/data';
import { savePublicationHistory } from '@/lib/publishing-studio/publication-history';

export const dynamic = 'force-dynamic';
async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new StudioAccessError('Unauthorized', 401);
  if (!canAccessDesignerTools(session.user.role)) throw new StudioAccessError('Designer access required.', 403);
  return session.user.id;
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof StudioAccessError ? error.message : 'Could not update publication history. Reload to check your saved work.' },
    { status: error instanceof StudioAccessError ? error.status : 500 });
}
export async function GET(request: NextRequest) {
  try {
    const userId = await actor();
    const data = await getStudioData(userId, request.nextUrl.searchParams.get('project') || undefined);
    return NextResponse.json({ history: data.publicationHistory || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await actor();
    const history = await savePublicationHistory(userId, await request.json().catch(() => null));
    revalidatePath('/designer/studio');
    return NextResponse.json({ history });
  } catch (error) { return failure(error); }
}
