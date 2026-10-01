import { assertLiveOrigin, LiveError } from '@/lib/live-interview/config';
import { assertLiveBrowserActor, liveFailure, liveResponse, readLiveJson } from '@/lib/live-interview/http';
import { controlLiveSession, endLiveSession, readLiveSession, receiveLiveEvent, recoverLiveTurn, refreshLiveReview, linkLiveImage, prepareLiveText } from '@/lib/live-interview/service';

export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(_request:Request,{params}:{params:{id:string}}){
  try{return liveResponse(await readLiveSession(await assertLiveBrowserActor(),params.id));}catch(error){return liveFailure(error);}
}
export async function POST(request:Request,{params}:{params:{id:string}}){
  try{
    assertLiveOrigin(request);const actor=await assertLiveBrowserActor();const body=await readLiveJson(request);
    switch(body.action){
      case 'event':return liveResponse(await receiveLiveEvent(actor,params.id,body.event));
      case 'recover':return liveResponse(await recoverLiveTurn(actor,params.id,body));
      case 'refresh_review':return liveResponse(await refreshLiveReview(actor,params.id));
      case 'link_image':return liveResponse(await linkLiveImage(actor,params.id,body));
      case 'prepare_text':return liveResponse(await prepareLiveText(actor,params.id,body));
      case 'control':return liveResponse(await controlLiveSession(actor,params.id,body.command));
      case 'pause':case 'end':case 'switch_to_text':return liveResponse(await endLiveSession(actor,params.id,body.action));
      default:throw new LiveError('Unknown interview action.',400);
    }
  }catch(error){return liveFailure(error);}
}
