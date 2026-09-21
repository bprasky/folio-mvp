import { NextRequest, NextResponse } from 'next/server';
import { listReadiness, refreshReadiness, ReadinessError } from '@/lib/publishing-studio/readiness/service';
import { readinessActor, readinessFailure } from '@/lib/publishing-studio/readiness/http';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET() {
  try { return NextResponse.json(await listReadiness(await readinessActor()), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return readinessFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const userId = await readinessActor();
    const body = await request.json();
    if (body?.action !== 'refresh') throw new ReadinessError('Choose review stories.');
    return NextResponse.json(await refreshReadiness(userId));
  } catch (error) { return readinessFailure(error); }
}
