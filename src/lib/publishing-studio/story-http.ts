import 'server-only';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { StoryError } from './story-service';
import { StudioAccessError } from './data';
export async function storyActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new StoryError('Sign in to use your Studio.', 401);
  return session.user.id;
}
export function storyFailure(error: unknown) {
  if (error instanceof StoryError || error instanceof StudioAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  console.error('[studio-story]', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({ error: 'Could not finish this step. Your saved work is unchanged; reload before retrying.' }, { status: 503 });
}
