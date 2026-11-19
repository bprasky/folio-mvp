export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { deleteStudio, reviewStudioDeletion, StudioDeletionError } from '@/lib/server/studio-deletion';
import { SpotlightConflict } from '@/lib/spotlight/gate';

type Context = { params: { orgId: string } | Promise<{ orgId: string }> };
const headers = { 'Cache-Control': 'private, no-store' };
const inputSchema = z.object({ confirmation: z.string().min(1).max(500), version: z.string().regex(/^[a-f0-9]{64}$/), acknowledged: z.literal(true) }).strict();

function failure(error: unknown) {
  if (error instanceof StudioDeletionError || error instanceof SpotlightConflict)
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'P2034' || code === 'P2002') return NextResponse.json({ error: 'The studio changed during this request. Retry, or review deletion again.' }, { status: 409, headers });
  if (code === 'P2003') return NextResponse.json({ error: 'This studio has connected records that need Folio review before deletion. Nothing was deleted.' }, { status: 409, headers });
  console.error('[Studio deletion] Request failed', { code });
  return NextResponse.json({ error: 'We could not confirm deletion. Retry this request to check its result safely.' }, { status: 500, headers });
}

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to manage this studio.' }, { status: 401, headers });
    const { orgId } = await params;
    return NextResponse.json(await reviewStudioDeletion(session.user.id, orgId), { headers });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to manage this studio.' }, { status: 401, headers });
    // This destructive cookie-authenticated request must come from our own UI.
    if (request.headers.get('origin') !== request.nextUrl.origin || request.headers.get('sec-fetch-site') === 'cross-site')
      return NextResponse.json({ error: 'Open studio settings to confirm deletion.' }, { status: 403, headers });
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return NextResponse.json({ error: 'A deletion confirmation is required.' }, { status: 400, headers });
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ error: 'The confirmation is too large.' }, { status: 413, headers });
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return NextResponse.json({ error: 'The confirmation is invalid.' }, { status: 400, headers }); }
    const parsed = inputSchema.safeParse(value);
    if (!parsed.success) return NextResponse.json({ error: 'Review the studio, type its name, and acknowledge the deletion.' }, { status: 400, headers });
    const { orgId } = await params;
    const result = await deleteStudio(session.user.id, orgId, parsed.data);
    // Invalidation is after commit. A cache failure cannot turn a committed
    // deletion into a misleading failure; retries still use the durable receipt.
    try {
      revalidatePath('/', 'layout');
      for (const path of ['/', '/projects', '/directory', '/settings', `/org/${orgId}`, ...result.paths]) revalidatePath(path);
    } catch { console.error('[Studio deletion] Cache refresh needed', { orgId }); }
    return NextResponse.json({ deleted: true, orgId, replayed: result.replayed }, { headers });
  } catch (error) { return failure(error); }
}
