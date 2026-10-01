import { assertLiveOrigin } from '@/lib/live-interview/config';
import { assertLiveBrowserActor, liveFailure, liveResponse, readLiveJson } from '@/lib/live-interview/http';
import { liveAvailability, parseLiveSource, startLiveSession } from '@/lib/live-interview/service';

export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:Request){
  try{return liveResponse(await liveAvailability(await assertLiveBrowserActor(),parseLiveSource(JSON.parse(new URL(request.url).searchParams.get('source')??'null'))));}
  catch(error){return liveFailure(error);}
}
export async function POST(request:Request){
  try{assertLiveOrigin(request);const actor=await assertLiveBrowserActor();return liveResponse(await startLiveSession(actor,await readLiveJson(request)));}
  catch(error){return liveFailure(error);}
}
