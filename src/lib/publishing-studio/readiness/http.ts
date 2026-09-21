import 'server-only';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { canAccessDesignerTools } from '@/lib/permissions';
import { CandidateConflictError } from './store';
import { ReadinessError } from './service';
import { readinessEnabled } from './sources';

export async function readinessActor() {
  if (!readinessEnabled()) throw new ReadinessError('Not available.', 404);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new ReadinessError('Sign in to use your Studio.', 401);
  if (!canAccessDesignerTools(session.user.role)) throw new ReadinessError('Designer access required.', 403);
  return session.user.id;
}
export function readinessFailure(error: unknown) {
  if (error instanceof CandidateConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ReadinessError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('[studio-readiness] operation failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({ error: 'Could not finish this step. Reload the Studio to check your latest saved work before retrying.' }, { status: 503 });
}
