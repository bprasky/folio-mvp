import 'server-only';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { LiveError } from './config';
import { LiveStoreError } from './store';

export const PRIVATE_HEADERS = { 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer' };
export async function assertLiveBrowserActor() {
  const session=await getServerSession(authOptions);
  if(!session?.user?.id)throw new LiveError('Sign in to continue.',401);
  return session.user.id;
}
/** Bounded streaming read also handles requests without Content-Length. No silent transcript truncation. */
export async function readLiveJson(request:Request) {
  const max=512*1024;const reader=request.body?.getReader();
  if(!reader)throw new LiveError('A JSON request is required.',400);
  const chunks:Uint8Array[]=[];let length=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
      if(length>max){await reader.cancel();throw new LiveError('This speech source exceeds the live request limit. Continue in text; no answer was shortened.',413);}
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch(error){if(error instanceof LiveError)throw error;throw new LiveError('Invalid JSON request.',400);}
}
export function liveResponse(value:unknown){return NextResponse.json(value,{headers:PRIVATE_HEADERS});}
export function liveFailure(error:unknown){
  const known=error instanceof LiveError || error instanceof LiveStoreError;
  return NextResponse.json({error:known?error.message:'The live interview request could not be completed. Your saved progress is retained.',
    message:known?error.message:'The live interview request could not be completed. Your saved progress is retained.'},
    {status:known?error.status:503,headers:PRIVATE_HEADERS});
}
