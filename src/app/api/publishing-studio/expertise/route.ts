import { NextRequest, NextResponse } from 'next/server';
import { storyActor, storyFailure } from '@/lib/publishing-studio/story-http';
import { listExpertise, discoverOpportunities, dismissOpportunity, startExpertise, recordExpertiseImpressions, compareExamples } from '@/lib/publishing-studio/expertise/service';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET() {
  try { return NextResponse.json(await listExpertise(await storyActor()), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return storyFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await storyActor(); const body = await request.json();
    if (body?.action === 'discover') return NextResponse.json(await discoverOpportunities(actor, body.projectIds, body.topic));
    if (body?.action === 'impressions') return NextResponse.json(await recordExpertiseImpressions(actor, body.opportunityIds));
    if (body?.action === 'compare') return NextResponse.json(await compareExamples(actor, body.evidenceIds, body.topic));
    if (body?.action === 'start' && typeof body.opportunityId === 'string') return NextResponse.json(await startExpertise(actor, body.opportunityId));
    if (body?.action === 'dismiss' && typeof body.opportunityId === 'string') return NextResponse.json(await dismissOpportunity(actor, body.opportunityId, body.reason));
    return NextResponse.json({ error: 'Choose a supported expertise action.' }, { status: 400 });
  } catch (error) { return storyFailure(error); }
}
