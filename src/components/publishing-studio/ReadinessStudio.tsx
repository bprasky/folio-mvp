'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudioPublicationCard } from './StudioPublicationCard';
import { candidateOpportunity } from '@/lib/publishing-studio/opportunities';
import { usePersonalIntroduction } from './usePersonalIntroduction';
import type { Candidate } from '@/lib/publishing-studio/readiness/types';
import { DISMISSAL_REASONS } from '@/lib/publishing-studio/readiness/types';
import { candidatePresentation, storySections } from '@/lib/publishing-studio/readiness/presentation';
import { CandidateConfigurator, updateCandidate } from './CandidateConfigurator';
import { StudioDiscovery, AboutMeInvitation, ActivityInvitations, matchesStoryFormat } from './StudioDiscovery';
import { StudioSavedActivities } from './StudioSavedActivities';
import { ExpertiseSection } from './expertise/ExpertiseSection';
import { StudioIntro, StudioPhoto, StudioTabs, studioAction, type StudioTab } from './StudioWorkspace';

const SavedWork = dynamic(() => import('./PublishingStudio').then(module => module.PublishingStudio));
const quietAction = 'folio-meta text-folio-text-secondary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50';
type Work = { candidate: Candidate; needsReview: boolean; lastWorkedAt?: string; exportedAt?: string; canDownload?: boolean };
type Data = { candidates: Candidate[]; developing: Candidate[]; dismissed?: Candidate[]; inProgress?: Work[]; exports?: Work[]; projects?: {id:string;title:string}[]; workspace?: {name:string} };
async function event(candidate: Candidate, kind: 'shown' | 'opened', eventId: string) {
  const response = await fetch(`/api/publishing-studio/readiness/${encodeURIComponent(candidate.id)}/events`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:candidate.version,sourceVersion:candidate.sourceVersion,kind,eventId}) });
  if (!response.ok) throw new Error('Could not record story view');
}

export function CandidateCard({ candidate, projectNames, onOpen, onDismiss, portfolio = false }: { candidate: Candidate; projectNames: (id:string)=>string; onOpen:()=>void; onDismiss?:(reason:string)=>void; portfolio?:boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(new Map<string,{id:string;complete:boolean;pending:boolean}>());
  const [reason,setReason]=useState('');
  const [imageUnavailable,setImageUnavailable]=useState(false);
  useEffect(()=>{
    const node=ref.current;if(!node||typeof IntersectionObserver==='undefined')return;
    const key=`${candidate.id}:${candidate.version}:${candidate.sourceVersion}`;
    const state=tracked.current.get(key)||{id:crypto.randomUUID(),complete:false,pending:false};tracked.current.set(key,state);
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.5)||state.complete||state.pending)return;
      state.pending=true;void event(candidate,'shown',state.id).catch(()=>event(candidate,'shown',state.id)).then(()=>{state.complete=true}).catch(()=>{}).finally(()=>{state.pending=false});
    },{threshold:.5});observer.observe(node);return()=>observer.disconnect();
  },[candidate]);
  const info=candidatePresentation(candidate);
  const opportunity=candidateOpportunity(candidate);
  const blockers = candidate.blockers.filter(blocker => !blocker.answer?.trim());
  const actionLabel = blockers[0]?.kind === 'visual' ? 'Choose your cover' : blockers[0]?.kind === 'credit' ? 'Complete the credit' : blockers.length ? 'Add your perspective' : 'Polish this post';
  return <div ref={ref} className="min-w-0">
    <StudioPublicationCard title={candidate.draft.headline}
      metadata={`${info.label} · ${candidate.projectIds.map(projectNames).join(' · ')}`}
      preview={<div><StudioPhoto images={candidate.visuals.slice(0,1)} onUnavailable={setImageUnavailable} alt={candidate.draft.headline} className="aspect-[4/5] rounded-xl" /><h3 className="folio-h4 mt-3">{candidate.draft.headline}</h3></div>}
      benefit={opportunity.purpose} contribution={imageUnavailable ? 'Review the unavailable cover image.' : blockers[0]?.question || 'Review your caption and photographs before downloading.'}
      actionLabel={actionLabel} onAction={onOpen} supportingSources={candidate.projectIds} readiness={candidate.readiness === 'ready' ? 'prepared' : 'working'} />
    {onDismiss && <details className="mt-3"><summary className="cursor-pointer folio-meta text-folio-text-secondary">Dismiss suggestion</summary><div className="mt-3 space-y-3"><div role="group" aria-label="Optional dismissal reason" className="flex flex-wrap gap-2">{DISMISSAL_REASONS.map(item => <button key={item} type="button" aria-pressed={reason === item} className="rounded-full border border-folio-border-subtle px-3 py-1 folio-meta" onClick={() => setReason(reason === item ? '' : item)}>{item.replaceAll('_',' ')}</button>)}</div><button className={quietAction} onClick={() => onDismiss(reason)}>Dismiss</button></div></details>}
  </div>;
}

export function ReadinessStudio({ expertiseEnabled = false }: { expertiseEnabled?: boolean } = {}) {
  const params=useSearchParams(),router=useRouter();
  const {introduction,error:introductionError,reload:reloadIntroduction}=usePersonalIntroduction();
  const project=params.get('project')||'';
  const tab:StudioTab=params.get('tab')==='progress'?'progress':params.get('tab')==='exports'?'exports':'suggestions';
  const candidateId=params.get('candidate'), candidateVersion=params.get('candidateVersion');
  const [data,setData]=useState<Data|null>(null),[selected,setSelected]=useState<Candidate|null>(null);
  const [readOnly,setReadOnly]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(false);
  const openedQuery=useRef<string|null>(null);
  const [removeDraft,setRemoveDraft]=useState<Candidate|null>(null);
  const matches=(candidate:Candidate)=>!project||project==='studio-wide'||(project==='cross-project'?candidate.projectIds.length>1:candidate.projectIds.includes(project));
  const subject=params.get('subject')==='about-me'?'about-me':project==='studio-wide'?'':project;
  const format=params.get('format')||'';
  const ranked=(data?.candidates||[]).filter(candidate=>subject!=='about-me'&&matches(candidate)&&matchesStoryFormat(candidate,format));
  const sections=storySections(ranked);
  const developing=(data?.developing||[]).filter(candidate=>subject!=='about-me'&&matches(candidate)&&matchesStoryFormat(candidate,format));
  const projects=(data?.projects||[]).map(item=>({...item,thumbnail:[...(data?.candidates||[]),...(data?.developing||[])].flatMap(candidate=>candidate.visuals).find(image=>image.projectId===item.id)?.url}));
  const selectedProject=projects.find(item=>item.id===project);
  const primary=sections.primary.slice(0,!subject&&!format?2:3);
  const more=[...sections.primary.slice(primary.length),...sections.more];
  const projectName=(id:string)=>projects.find(item=>item.id===id)?.title||ranked.find(item=>item.projectIds.length===1&&item.projectIds[0]===id)?.source?.title||'Project';
  const reload=useCallback(async()=>{const response=await fetch('/api/publishing-studio/readiness',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not open Publishing Studio');setData(result)},[]);
  useEffect(()=>{void reload().catch(err=>setError(err.message))},[reload]);
  useEffect(()=>{
    if(!candidateId){openedQuery.current=null;setSelected(null);setReadOnly(false);return}const queryKey=`${candidateId}:${candidateVersion||''}`;if(openedQuery.current===queryKey||!data)return;
    const work=[...(data.inProgress||[]),...(data.exports||[])].find(item=>item.candidate.id===candidateId&&(!candidateVersion||String(item.candidate.version)===candidateVersion));
    const match=(candidateVersion?work?.candidate:undefined)||[...data.candidates,...data.developing,...(data.dismissed||[])].find(item=>item.id===candidateId&&(!candidateVersion||String(item.version)===candidateVersion))||work?.candidate;
    if(match){openedQuery.current=queryKey;setSelected(match);setReadOnly(Boolean((work?.candidate.version===match.version&&work.needsReview)||match.confirmedPublishedAt))}else{setSelected(null);setReadOnly(false)}
  },[candidateId,candidateVersion,data]);
  function navigate(changes:Record<string,string|null>){const next=new URLSearchParams(params.toString());for(const[key,value]of Object.entries(changes))value?next.set(key,value):next.delete(key);router.replace(`/designer/studio${next.size?`?${next}`:''}`,{scroll:false})}
  function open(candidate:Candidate,readonly=false){setSelected(candidate);setReadOnly(readonly);openedQuery.current=`${candidate.id}:${readonly?candidate.version:''}`;navigate({candidate:candidate.id,candidateVersion:readonly?String(candidate.version):null});}
  async function refresh(){setPending(true);setError('');try{const response=await fetch('/api/publishing-studio/readiness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh'})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not evaluate stories');await reload()}catch(err){setError(err instanceof Error?err.message:'Could not evaluate stories')}finally{setPending(false)}}
  async function dismiss(candidate:Candidate,reason:string){try{await updateCandidate(candidate,{action:'dismiss',...(reason?{reason}:{})});await reload();setRemoveDraft(null)}catch(err){setError(err instanceof Error?err.message:'Could not dismiss story')}}
  async function restore(candidate:Candidate){try{await updateCandidate(candidate,{action:'restore'});await reload()}catch(err){setError(err instanceof Error?err.message:'Could not restore story')}}
  const card=(candidate:Candidate)=><CandidateCard key={candidate.id} candidate={candidate} projectNames={projectName} onOpen={()=>open(candidate)} onDismiss={reason=>void dismiss(candidate,reason)}/>;
  const work=tab==='progress'?data?.inProgress||[]:data?.exports||[];
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 text-folio-text-primary sm:px-6 sm:py-8">
    <StudioIntro/>
    {removeDraft&&<div role="alert" className="space-y-3 border border-folio-border-subtle bg-surface-ground p-4"><p className="folio-body">Remove “{removeDraft.draft.headline}” from In progress? Your saved version will remain available under Dismissed suggestions.</p><div className="flex gap-3"><button className={studioAction} onClick={()=>void dismiss(removeDraft,'other')}>Remove from In progress</button><button className={quietAction} onClick={()=>setRemoveDraft(null)}>Keep draft</button></div></div>}
    {!selected&&<StudioTabs value={tab} onChange={value=>{navigate({tab:value==='suggestions'?null:value,candidate:null,candidateVersion:null})}}/>}
    {error&&<div role="alert" className="folio-body"><p>{error}</p><button className={`${quietAction} mt-2`} onClick={()=>{setError('');void reload().catch(err=>setError(err.message))}}>Reload stories</button></div>}
    {selected?<><CandidateConfigurator key={`${selected.id}:${readOnly?selected.version:'current'}`}  candidate={selected} readOnly={readOnly} onChange={candidate=>{setSelected(candidate);void reload().catch(err=>setError(err.message))}} onClose={()=>{navigate({candidate:null,candidateVersion:null});setSelected(null);void reload().catch(err=>setError(err.message))}}/>{readOnly&&<p className="folio-body">Your saved version is retained for reference. {selected.projectIds.map(id=><Link key={id} href={`/project/${encodeURIComponent(id)}`} className={quietAction}>Open project </Link>)}</p>}</>:<section id="studio-panel" role="tabpanel" aria-labelledby={`studio-tab-${tab === 'exports' ? 'progress' : tab}`} tabIndex={0} className="space-y-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
      {tab==='suggestions'?<>
        <StudioDiscovery onClear={() => navigate({ subject: null, project: null, format: null, type: null, item: null })} projects={projects} subject={subject} format={format} onSubject={value=>navigate({subject:value==='about-me'?value:null,project:value==='about-me'?null:value,format:null})} onFormat={value=>navigate({format:value})}/>

        {subject!=='about-me'&&format!=='twenty_questions'&&<div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="folio-h3 sm:folio-h2">{project||format?'Stories to explore':'Recommended for you'}</h2></div><button className={quietAction} disabled={pending} onClick={refresh}>{pending?'Reviewing stories…':'Refresh suggestions'}</button></div>}
        {!data&&!error&&<p role="status" className="folio-body py-8">Opening your stories…</p>}
        {data&&subject!=='about-me'&&format!=='twenty_questions'&&!ranked.length&&<div className="bg-surface-ground p-6"><h3 className="folio-h3">No stories ready for review yet</h3><p className="folio-body mt-2">Refresh suggestions to review your published work. Your saved drafts remain in In progress.</p></div>}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Recommended stories">{primary.slice(0,1).map(card)}{!subject&&!format&&<AboutMeInvitation compact introduction={introduction?.status==='published'?null:introduction}/>}{primary.slice(1).map(card)}</div>
        {expertiseEnabled && <ExpertiseSection />}
        {introductionError&&<p role="status" className="folio-meta">{introductionError} <button className={quietAction} onClick={()=>void reloadIntroduction()}>Try again</button></p>}
        <ActivityInvitations introduction={introduction} omitTwenty={!subject && !format} project={selectedProject} format={format} personal={!project||subject==='about-me'}/>
        {(more.length > 0 || sections.portfolio) && <section aria-label="From your projects"><h2 className="folio-h2 mb-5">From your projects</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{more.map(card)}{sections.portfolio && <CandidateCard candidate={sections.portfolio} projectNames={projectName} portfolio onOpen={() => open(sections.portfolio!)} onDismiss={reason => void dismiss(sections.portfolio!, reason)} />}</div></section>}
        {!!developing.length&&<section className="border-t border-folio-border-subtle pt-5"><h2 className="folio-h3">More opportunities to develop ({developing.length})</h2><div className="mt-4 space-y-5">{developing.map(candidate=><article key={candidate.id}><h3 className="folio-h3">{candidate.thesis||candidate.source?.title}</h3><p className="folio-body mt-2">This story needs more source material or editorial development.</p><button className={`${quietAction} mt-2`} onClick={()=>open(candidate)}>Review saved material</button></article>)}</div></section>}
        {!!data?.dismissed?.filter(matches).length&&<details className="border-t border-folio-border-subtle pt-5"><summary className="cursor-pointer folio-meta text-folio-text-secondary">Dismissed suggestions</summary>{data.dismissed.filter(matches).map(candidate=><div key={candidate.id} className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="folio-body">{candidate.thesis}</span><button className={quietAction} onClick={()=>restore(candidate)}>Restore</button></div>)}</details>}
      </>:<>
        <div><h2 className="folio-h2">{tab==='progress'?'Pick up where you left off':'Your exports'}</h2><p className="folio-body mt-1">{tab==='progress'?'Your saved words, selected images, and started stories.':'Previously prepared downloads. Exporting does not confirm publication.'}</p></div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{work.filter(item=>matches(item.candidate)).map(item=><div key={`${item.candidate.id}:${item.candidate.version}`}>
          <StudioPublicationCard title={item.candidate.draft.headline} preview={<div><StudioPhoto images={item.candidate.visuals.slice(0,1)} alt={item.candidate.draft.headline} className="aspect-[4/5] rounded-xl" /><h3 className="folio-h4 mt-3">{item.candidate.draft.headline}</h3></div>}
            metadata={item.candidate.confirmedPublishedAt ? 'Publication recorded · Confirmed by you' : item.needsReview ? 'Earlier version · saved work retained' : 'Saved work'} benefit={item.candidate.audienceValue} contribution={item.needsReview ? 'Review the changed sources before continuing.' : 'Review your saved caption and photographs.'}
            actionLabel={item.needsReview||item.candidate.confirmedPublishedAt?'View saved work':tab==='exports'&&item.canDownload?'Review and download':'Continue editing'} onAction={()=>open(item.candidate,item.needsReview||Boolean(item.candidate.confirmedPublishedAt))} readiness="saved" />
          {tab==='progress'&&!item.needsReview&&!item.candidate.confirmedPublishedAt&&<button className={`${quietAction} mt-3`} onClick={()=>setRemoveDraft(item.candidate)}>Remove draft</button>}
        </div>)}</div>
        {tab==='progress'&&<>{expertiseEnabled&&<ExpertiseSection saved/>}<StudioSavedActivities/></>}
        <SavedWork embedded/>
      </>}
    </section>}
  </main>;
}
