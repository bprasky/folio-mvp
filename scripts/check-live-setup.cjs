// Read-only readiness checks. Never creates a PAL/conversation, enables flags, or applies DDL.
require('dotenv').config({path:'.env.local',quiet:true});require('dotenv').config({quiet:true});
const {spawnSync}=require('node:child_process');
const args=new Set(process.argv.slice(2));let failed=false;
function report(name,ok,detail=''){console.log(`${ok?'PASS':'MISSING'} ${name}${detail?`: ${detail}`:''}`);if(!ok)failed=true;}
async function main(){
 const required=['TAVUS_API_KEY','NEXTAUTH_SECRET','DATABASE_URL','FOLIO_LIVE_BASE_URL','FOLIO_LIVE_ALLOWLIST'];
 for(const name of required)report(name,Boolean(process.env[name]?.trim()));
 let base;try{base=new URL(process.env.FOLIO_LIVE_BASE_URL);report('HTTPS backend origin',base.protocol==='https:'&&base.pathname==='/'&&!base.username&&!base.password&&!base.search&&!base.hash);}catch{report('HTTPS backend origin',false);}
 console.log('STATIC flags: live='+ (process.env.FOLIO_LIVE_INTERVIEWS==='1')+', recording='+(process.env.FOLIO_INTERVIEW_RECORDING==='1')+', exports='+(process.env.FOLIO_INTERVIEW_MEDIA_EXPORTS==='1'));
 for(const binary of ['ffmpeg','ffprobe']){const r=spawnSync(process.env[binary==='ffmpeg'?'FFMPEG_PATH':'FFPROBE_PATH']||binary,['-version'],{encoding:'utf8',windowsHide:true,timeout:10_000,shell:false});report(binary,r.status===0,r.status===0?(r.stdout.split('\n')[0].split(' Copyright')[0]):'Set FFMPEG_PATH/FFPROBE_PATH or use Dockerfile.interview-media.');}
 if(args.has('--provider')){
  if(!process.env.TAVUS_API_KEY)report('LIVE provider read',false,'TAVUS_API_KEY required.');
  else{try{const face=process.env.TAVUS_FACE_ID||'rc9cff32ceba';const r=await fetch(`https://tavusapi.com/v2/faces/${encodeURIComponent(face)}`,{headers:{'x-api-key':process.env.TAVUS_API_KEY},signal:AbortSignal.timeout(15_000)});const data=await r.json();report('LIVE Tavus API + configured Face',r.ok&&data.face_id===face,`HTTP ${r.status}; no conversation created.`);}catch{report('LIVE provider read',false,'API read failed; response body withheld.');}}
 }
 if(args.has('--reachability')){
  if(!base)report('LIVE backend rejects invalid credentials',false,'HTTPS origin required.');
  else{try{const r=await fetch(`${base.origin}/api/live-interviews/provider/setup-check/v1/chat/completions`,{method:'POST',redirect:'manual',headers:{authorization:'Bearer invalid-setup-probe','content-type':'application/json'},body:JSON.stringify({stream:true,messages:[]}),signal:AbortSignal.timeout(15_000)});report('LIVE backend rejects invalid credentials',r.status===401,`HTTP ${r.status}; expected 401, not an SSO page/redirect.`);}catch{report('LIVE backend authentication probe',false,'Not reachable.');}}
 }
 if(args.has('--storage')){
  try{
   const {createClient}=require('@supabase/supabase-js');const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
   if(!url||!key||process.env.INTERVIEW_MEDIA_BUCKET!=='interview-media')throw Error();
   const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await db.storage.getBucket('interview-media');
   report('LIVE private capture bucket',!error&&data?.public===false&&(!data.file_size_limit||Number(data.file_size_limit)>=5*1024*1024));
   report('LIVE capture/output MIME allowlist',!error&&!!data&&(!data.allowed_mime_types||['audio/webm','video/webm','audio/mp4','video/mp4'].every(mime=>data.allowed_mime_types.includes(mime))),'Requires audio/webm, video/webm, audio/mp4 and video/mp4.');
   console.log('Storage accepts rendered objects only up to its configured file_size_limit; larger outputs fail visibly.');
  }catch{report('LIVE private capture bucket',false,'Check existing Supabase server configuration and INTERVIEW_MEDIA_BUCKET.');}
 }
 if(args.has('--database')){
  const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
  try{const rows=await db.$queryRaw`SELECT to_regclass('public.live_interview_sessions')::text AS sessions,to_regclass('public.interview_media_records')::text AS media`;report('LIVE private transport/media tables',Boolean(rows[0]?.sessions&&rows[0]?.media),'Read-only; never applies the migration.');}
  catch{report('LIVE database metadata',false,'Connection unavailable.');}finally{await db.$disconnect();}
 }
 console.log('Static and read-only checks do not prove real Tavus speech, browser capture, or worker deployment.');
 if(failed)process.exitCode=1;
}
main().catch(()=>{console.error('Setup check failed; no secret or provider payload has been printed.');process.exitCode=1;});
