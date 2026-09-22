import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { storyActor, storyFailure } from '@/lib/publishing-studio/story-http';
import { listReleasePlans, readReleasePlan, saveReleasePlan } from '@/lib/publishing-studio/release-plan-service';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try { const actor = await storyActor(); const projectId = request.nextUrl.searchParams.get('projectId');
    return NextResponse.json(projectId ? await readReleasePlan(actor, projectId) : await listReleasePlans(actor), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return storyFailure(error); }
}
export async function PUT(request: NextRequest) {
  try {
    const actor = await storyActor();
    const result = await saveReleasePlan(actor, await request.json());
    revalidatePath('/designer/studio');
    return NextResponse.json(result);
  } catch (error) { return storyFailure(error); }
}
