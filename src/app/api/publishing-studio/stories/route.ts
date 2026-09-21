import { NextRequest, NextResponse } from 'next/server';
import { listStories, startStory } from '@/lib/publishing-studio/story-service';
import { storyActor, storyFailure } from '@/lib/publishing-studio/story-http';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET() {
  try { return NextResponse.json(await listStories(await storyActor()), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return storyFailure(error); }
}
export async function POST(request: NextRequest) {
  try { const actor = await storyActor(); const body = await request.json(); return NextResponse.json(await startStory(actor, body?.brief, body?.idempotencyKey)); }
  catch (error) { return storyFailure(error); }
}
