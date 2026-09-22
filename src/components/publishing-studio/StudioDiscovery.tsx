'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, UserRound } from 'lucide-react';
import { StudioPhoto, studioAction } from './StudioWorkspace';
import { activityOpportunity } from '@/lib/publishing-studio/opportunities';
import type { PersonalIntroduction } from './usePersonalIntroduction';

export type DiscoveryProject = { id: string; title: string; thumbnail?: string | null };
export const storyFormats = [
  { id: '', label: 'All stories' }, { id: 'room', label: 'Room features' },
  { id: 'project', label: 'Project stories' }, { id: 'twenty_questions', label: '20 Questions' }, { id: 'material', label: 'Materials' },
  { id: 'process', label: 'Process' },
];

/** Subject and format are independent, visible choices. Selection never starts an activity. */
export function StudioDiscovery({ projects, subject, format, onSubject, onFormat }: {
  projects: DiscoveryProject[]; subject: string; format: string;
  onSubject(value: string): void; onFormat(value: string): void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const choices = [{ id: '', title: 'All work' }, { id: 'about-me', title: 'About me' }, ...projects];
  const scroll = (direction: number) => strip.current?.scrollBy({ left: direction * strip.current.clientWidth * .75, behavior: 'smooth' });
  return <div className="space-y-3 py-3">
    <div className="flex items-center justify-between gap-3"><p className="folio-meta text-folio-text-secondary">Explore by project or format</p><div className="flex gap-2"><button type="button" aria-label="Previous projects" onClick={() => scroll(-1)} className="rounded-full border border-folio-border-subtle p-2"><ArrowLeft className="h-4 w-4" /></button><button type="button" aria-label="More projects" onClick={() => scroll(1)} className="rounded-full border border-folio-border-subtle p-2"><ArrowRight className="h-4 w-4" /></button></div></div>
    <div ref={strip} role="group" aria-label="Story subject" className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {choices.map(choice => <button type="button" key={choice.id} aria-pressed={subject === choice.id || (!subject && choice.id === '')} onClick={() => onSubject(choice.id)} className={`w-24 shrink-0 snap-start rounded-xl p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${subject === choice.id ? 'bg-surface-ground ring-1 ring-folio-text-primary' : 'hover:bg-surface-ground'}`}>
        {'thumbnail' in choice && choice.thumbnail ? <StudioPhoto images={[{ id: choice.id, url: choice.thumbnail }]} alt="" className="aspect-[4/3] rounded-lg" /> : <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-surface-elevated">{choice.id === 'about-me' ? <UserRound className="h-7 w-7" aria-hidden="true" /> : <span className="folio-h3" aria-hidden="true">{choice.id ? choice.title.slice(0, 1) : 'F'}</span>}</div>}
        <span className="mt-2 block line-clamp-2 px-1 pb-1 folio-ui">{choice.title}</span>
      </button>)}
    </div>
    {subject !== 'about-me' && <div role="group" aria-label="Story format" className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap">{storyFormats.map(item => <button key={item.id} type="button" aria-pressed={format === item.id} onClick={() => onFormat(item.id)} className={`shrink-0 rounded-full border px-4 py-2 folio-ui focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${format === item.id ? 'border-folio-text-primary bg-folio-text-primary text-white' : 'border-folio-border-subtle hover:bg-surface-ground'}`}>{item.label}</button>)}</div>}
  </div>;
}

export function AboutMeInvitation({ compact = false, bio = false, introduction }: { compact?: boolean; bio?: boolean; introduction?: PersonalIntroduction | null }) {
  if (!bio && !introduction) return null;
  const opportunity = activityOpportunity(bio ? 'bio' : 'twenty_questions');
  const published = !bio && introduction?.status === 'published' && !introduction.needsReview;
  const draft = !bio && (introduction?.status === 'draft' || introduction?.needsReview);
  return <article className={`flex flex-col rounded-xl bg-surface-ground p-6 ${compact ? 'order-first sm:order-none' : 'sm:p-8'}`}>
    <div><UserRound aria-hidden="true" className="h-7 w-7 mb-4" />
      <h3 className="folio-h3">{published ? 'Your personal introduction is ready to share.' : draft ? 'Keep shaping your personal introduction.' : opportunity.purpose}</h3>
      <p className="folio-body mt-3 text-folio-text-secondary">{published ? 'Your published article gives readers a way to meet the person behind the work.' : opportunity.reason}</p>
      {!published && <p className="folio-body mt-3 text-folio-text-secondary">{draft ? 'Return to your saved answers, then review and edit the article.' : opportunity.path} {opportunity.result}</p>}
      <p className="folio-meta mt-3 text-folio-text-secondary">{published ? 'Published on your Folio profile · Share the article link' : opportunity.destination}</p>
    </div>
    <div className="mt-6"><Link className={studioAction} href={published ? introduction?.publishedUrl || introduction?.href || '/designer/studio?tab=progress' : draft ? introduction?.href || '/designer/studio?tab=progress' : opportunity.href!}>{published ? 'View my introduction' : draft ? 'Continue my introduction' : opportunity.action} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link><p className="folio-meta mt-3 text-folio-text-secondary">{opportunity.metadata}</p></div>
  </article>;
}

export function ActivityInvitations({ project, format = '', personal = false, omitTwenty = false, introduction }: { project?: DiscoveryProject; format?: string; personal?: boolean; omitTwenty?: boolean; introduction?:PersonalIntroduction|null }) {
  const formats = ['twenty_questions', 'qa', 'material', 'method'].filter(item => !(omitTwenty && item === 'twenty_questions')).filter(item => !format || item === format || (format === 'process' && item === 'method') || (format === 'room' && item === 'qa') || (format === 'project' && item === 'qa'));
  return <section aria-label={personal ? 'Make your profile yours' : 'Stories you can start'} className="space-y-5">
    <header><h2 className="folio-h2">{personal ? 'Help people understand your practice' : project ? `More to say about ${project.title}` : 'Tell your story'}</h2><p className="folio-body mt-2 text-folio-text-secondary">Choose what you want people to understand. Your perspective becomes a story you can review and share.</p></header>
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {personal && !format && <AboutMeInvitation bio />}
      {formats.map(format => {
        if(format==='twenty_questions'&&!project)return <AboutMeInvitation key={format} introduction={introduction}/>;
        const opportunity=activityOpportunity(format,project);
        return <article key={format} className="flex flex-col rounded-xl border border-folio-border-subtle p-6"><h3 className="folio-h3">{opportunity.purpose}</h3><p className="folio-body mt-3 text-folio-text-secondary">{opportunity.reason}</p><p className="folio-body mt-3 text-folio-text-secondary">{opportunity.path}</p><p className="folio-meta mt-3 text-folio-text-secondary">{opportunity.result} {opportunity.destination}</p><Link className={`${studioAction} mt-6 self-start`} href={opportunity.href!}>{opportunity.action}</Link><p className="folio-meta mt-3 text-folio-text-secondary">{opportunity.metadata}</p></article>;
      })}
    </div>
  </section>;
}

/** Use source metadata, never headline keyword guesses, to classify a prepared story. */
export function matchesStoryFormat(item: { roomId?: string; origin?: string; format?: string; shape?: string }, format: string) {
  const kind = (item.format || '').toLowerCase();
  if (!format) return true;
  if (format === 'room') return Boolean(item.roomId || item.origin === 'room' || kind === 'room_story');
  if (format === 'project') return item.origin === 'project' || kind === 'project_story';
  if (format === 'material') return item.shape === 'material' || ['material', 'material_study'].includes(kind);
  if (format === 'process') return ['process', 'decision', 'constraint', 'transformation'].includes(item.shape || '') || ['method', 'process'].includes(kind);
  return false;
}
