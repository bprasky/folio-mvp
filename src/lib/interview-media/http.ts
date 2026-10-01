import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { ZodError } from 'zod';
import { MediaError } from './types';

export async function assertMediaActor(work: (actor: string) => Promise<unknown>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  try { return NextResponse.json(await work(session.user.id), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) {
    const status = error instanceof MediaError ? error.status : error instanceof ZodError ? 400 :
      error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    return NextResponse.json({ error: status < 500 && error instanceof Error && !(error instanceof ZodError) ? error.message :
      status === 400 ? 'Check the media selection and try again.' : 'Media is unavailable. Your saved interview answers are safe.' }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
export async function smallJson(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new MediaError('Cross-origin media changes are not allowed.', 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new MediaError('Send a JSON media request.', 415);
  if (Number(request.headers.get('content-length') || 0) > 128 * 1024) throw new MediaError('This request is too large.', 413);
  const text = await request.text();
  if (text.length > 128 * 1024) throw new MediaError('This request is too large.', 413);
  try { return JSON.parse(text); } catch { throw new MediaError('Invalid media request.'); }
}
