import { assertLiveBackendAuth, parseUserHistory, processBackendTurn } from '@/lib/live-interview/service';
import { completionStream } from '@/lib/live-interview/turns';
import { liveFailure, PRIVATE_HEADERS, readLiveJson } from '@/lib/live-interview/http';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=120;
/** Narrow machine endpoint: no browser-cookie fallback and no middleware/protection changes. */
export async function POST(request:Request,{params}:{params:{id:string}}){
  try{
    const session=await assertLiveBackendAuth(params.id,request.headers.get('authorization'));
    const users=parseUserHistory(await readLiveJson(request));
    const content=await processBackendTurn(session,users);
    return new Response(completionStream(`chatcmpl-${session.id}-${users.length}`,content),{
      headers:{...PRIVATE_HEADERS,'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'},
    });
  }catch(error){return liveFailure(error);}
}
