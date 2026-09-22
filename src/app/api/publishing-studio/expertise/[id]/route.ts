import { NextRequest, NextResponse } from 'next/server';
import { storyActor, storyFailure } from '@/lib/publishing-studio/story-http';
import { readExpertise, changeExpertise } from '@/lib/publishing-studio/expertise/service';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try { return NextResponse.json(await readExpertise(await storyActor(), params.id), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return storyFailure(error); }
}
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try { return NextResponse.json(await changeExpertise(await storyActor(), params.id, await request.json())); }
  catch (error) { return storyFailure(error); }
}
