import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { changeStory, readStory } from '@/lib/publishing-studio/story-service';
import { storyActor, storyFailure } from '@/lib/publishing-studio/story-http';
export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try { return NextResponse.json(await readStory(await storyActor(), params.id), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return storyFailure(error); }
}
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await storyActor(); const body = await request.json();
    const saved = await changeStory(actor, params.id, body || {});
    revalidatePath('/designer/studio');
    if (body?.action === 'publish') { revalidatePath(`/designer/${actor}`); revalidatePath(`/profile/${actor}`); if (saved.publishedUrl) revalidatePath(saved.publishedUrl); }
    return NextResponse.json(saved);
  } catch (error) { return storyFailure(error); }
}
