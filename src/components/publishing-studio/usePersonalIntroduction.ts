'use client';
import { useCallback, useEffect, useState } from 'react';

export type PersonalIntroduction = {status:'available'|'draft'|'published';id?:string;href?:string;publishedUrl?:string;needsReview?:boolean};
/** Unknown/loading/error never proves the designer has no completed introduction. */
export function usePersonalIntroduction() {
  const [introduction,setIntroduction]=useState<PersonalIntroduction|null>(null);
  const [error,setError]=useState('');
  const reload=useCallback(async()=>{setIntroduction(null);setError('');try{const response=await fetch('/api/publishing-studio/stories',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not check your introduction.');const value=result.personalIntroduction;if(!value||!['available','draft','published'].includes(value.status))throw new Error('Could not check your introduction.');setIntroduction(value);}catch(err){setError(err instanceof Error?err.message:'Could not check your introduction.');}},[]);
  useEffect(()=>{void reload()},[reload]);
  return {introduction,error,reload};
}
