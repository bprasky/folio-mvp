import { assertLiveOrigin } from '@/lib/live-interview/config';
import { assertLiveBrowserActor, liveFailure, liveResponse, readLiveJson } from '@/lib/live-interview/http';
import { previewLiveAnswerCleanup } from '@/lib/live-interview/answer-cleanup';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    assertLiveOrigin(request);
    const actor = await assertLiveBrowserActor();
    return liveResponse(await previewLiveAnswerCleanup(actor, params.id, await readLiveJson(request)));
  } catch (error) { return liveFailure(error); }
}
