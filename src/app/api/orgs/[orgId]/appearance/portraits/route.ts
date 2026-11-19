import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { rateLimit } from '@/lib/rateLimit';
import { readImageBody } from '@/lib/server/project-image-input';
import { cutoutPortrait, ownedProfileImage, portraitCandidates, PortraitError, preparePortraitPhoto,
  removePreparedPortraits, requirePortraitAdmin, storePortrait } from '@/lib/server/org-portrait';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
type Context = { params: { orgId: string } | Promise<{ orgId: string }> };
const inputSchema = z.union([
  z.object({ importId: z.string().uuid(), candidateId: z.string().uuid() }).strict(),
  z.object({ originalUrl: z.string().url().max(2048), cutout: z.literal(true) }).strict(),
]);

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof PortraitError ? error.message : 'Could not prepare this photograph. Try another photo or upload your own.' },
    { status: error instanceof PortraitError ? error.status : error instanceof z.ZodError ? 400 : 500, headers });
}
async function access(params: Context['params']) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new PortraitError('Sign in to manage your cover.', 401);
  const { orgId } = await params;
  await requirePortraitAdmin(session.user.id, orgId);
  return { userId: session.user.id, orgId };
}
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { userId, orgId } = await access(params);
    const limit = await rateLimit({ userId, scope: 'portrait-preview', limit: 100, windowMs: 60_000 });
    if (!limit.ok) throw new PortraitError('Please wait a moment before loading more photographs.', 429);
    const importId = request.nextUrl.searchParams.get('import') || undefined;
    if (importId && !z.string().uuid().safeParse(importId).success) throw new PortraitError('Invalid import.');
    const candidates = await portraitCandidates(orgId, importId);
    const id = request.nextUrl.searchParams.get('candidate');
    if (id) {
      const candidate = candidates.find(item => item.id === id);
      if (!candidate) throw new PortraitError('Portrait suggestion not found.', 404);
      const photo = await preparePortraitPhoto(candidate.url);
      await requirePortraitAdmin(userId, orgId);
      return new NextResponse(new Uint8Array(photo), { headers: { ...headers, 'Content-Type': 'image/png' } });
    }
    return NextResponse.json({ candidates: candidates.map(candidate => ({ id: candidate.id, importId: candidate.importId, label: candidate.label, sourceUrl: candidate.sourceUrl,
      previewUrl: `/api/orgs/${orgId}/appearance/portraits?import=${candidate.importId}&candidate=${candidate.id}`,
    })) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  const created: string[] = [];
  try {
    const { userId, orgId } = await access(params);
    const input = inputSchema.parse(await readImageBody(request));
    const limit = await rateLimit({ userId, scope: 'portrait-prepare', limit: 20, windowMs: 3600_000 });
    if (!limit.ok) throw new PortraitError('You have prepared several portraits. Please try again later.', 429);
    if ('originalUrl' in input) {
      if (!ownedProfileImage(input.originalUrl, orgId)) throw new PortraitError('Choose a photograph uploaded for this studio.');
      const cutout = await cutoutPortrait(await preparePortraitPhoto(input.originalUrl));
      await requirePortraitAdmin(userId, orgId);
      const stored = await storePortrait(orgId, cutout); created.push(stored.path);
      await requirePortraitAdmin(userId, orgId);
      return NextResponse.json({ cutoutUrl: stored.url }, { headers });
    }
    const candidate = (await portraitCandidates(orgId, input.importId)).find(item => item.id === input.candidateId);
    if (!candidate) throw new PortraitError('Portrait suggestion not found.', 404);
    const original = await preparePortraitPhoto(candidate.url);
    await requirePortraitAdmin(userId, orgId);
    const stored = await storePortrait(orgId, original); created.push(stored.path);
    await requirePortraitAdmin(userId, orgId);
    return NextResponse.json({ originalUrl: stored.url }, { headers });
  } catch (error) {
    try { await removePreparedPortraits(created); } catch { console.error('[Portrait] Could not clean up prepared image'); }
    return failure(error);
  }
}
