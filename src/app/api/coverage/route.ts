import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { rateLimit } from '@/lib/rateLimit';
import { CoverageScopeSchema, CoverageReviewSchema } from '@/lib/coverage/schema';
import { CoverageError, coverageReviewList, findCoverage, reviewCoverage } from '@/lib/coverage/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;
const noStore = { 'Cache-Control': 'private, no-store' };
const SearchSchema = z.object({ scope: CoverageScopeSchema, url: z.string().max(2048).optional() }).strict();
async function actor(request: NextRequest, write = false) {
  if (write) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) throw new CoverageError('Please save from Folio.', 403);
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new CoverageError('Sign in to manage your coverage.', 401);
  return session.user.id;
}
function failure(error: unknown) {
  if (error instanceof CoverageError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'Check the feature details and try again.' }, { status: 400, headers: noStore });
  console.error('[coverage]', error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json({ error: 'Coverage could not be loaded or saved. Please try again; you can also add a publication link.' }, { status: 503, headers: noStore });
}
export async function GET(request: NextRequest) {
  try {
    const actorId = await actor(request);
    const scope = CoverageScopeSchema.parse({ type: request.nextUrl.searchParams.get('type'), id: request.nextUrl.searchParams.get('id') });
    return NextResponse.json(await coverageReviewList(actorId, scope), { headers: noStore });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const actorId = await actor(request, true);
    const { scope, url } = SearchSchema.parse(await request.json());
    const budget = await rateLimit({ userId: actorId, scope: url ? 'coverage-link' : 'coverage-search', limit: url ? 30 : 6, windowMs: 3600000 });
    if (!budget.ok) throw new CoverageError('You have reached the search limit for now. Please return later.', 429);
    return NextResponse.json(await findCoverage(actorId, scope, url), { headers: noStore });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    const actorId = await actor(request, true);
    const input = CoverageReviewSchema.parse(await request.json());
    const budget = await rateLimit({ userId: actorId, scope: 'coverage-review', limit: 60, windowMs: 3600000 });
    if (!budget.ok) throw new CoverageError('Please return to the review in a little while.', 429);
    return NextResponse.json(await reviewCoverage(actorId, input), { headers: noStore });
  } catch (error) { return failure(error); }
}
