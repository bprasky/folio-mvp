'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, UserRound } from 'lucide-react';
import { StudioPhoto, studioAction } from './StudioWorkspace';

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
    <div className="flex items-center justify-between gap-3"><p className="folio-meta text-folio-text-secondary">Where would you like to start?</p><div className="flex gap-2"><button type="button" aria-label="Previous projects" onClick={() => scroll(-1)} className="rounded-full border border-folio-border-subtle p-2"><ArrowLeft className="h-4 w-4" /></button><button type="button" aria-label="More projects" onClick={() => scroll(1)} className="rounded-full border border-folio-border-subtle p-2"><ArrowRight className="h-4 w-4" /></button></div></div>
    <div ref={strip} role="group" aria-label="Story subject" className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
      {choices.map(choice => <button type="button" key={choice.id} aria-pressed={subject === choice.id || (!subject && choice.id === '')} onClick={() => onSubject(choice.id)} className={`w-24 shrink-0 snap-start rounded-xl p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${subject === choice.id ? 'bg-surface-ground ring-1 ring-folio-text-primary' : 'hover:bg-surface-ground'}`}>
        {'thumbnail' in choice && choice.thumbnail ? <StudioPhoto images={[{ id: choice.id, url: choice.thumbnail }]} alt="" className="aspect-[4/3] rounded-lg" /> : <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-surface-elevated">{choice.id === 'about-me' ? <UserRound className="h-7 w-7" aria-hidden="true" /> : <span className="folio-h3" aria-hidden="true">{choice.id ? choice.title.slice(0, 1) : 'F'}</span>}</div>}
        <span className="mt-2 block line-clamp-2 px-1 pb-1 folio-ui">{choice.title}</span>
      </button>)}
    </div>
    {subject !== 'about-me' && <div role="group" aria-label="Story format" className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap">{storyFormats.map(item => <button key={item.id} type="button" aria-pressed={format === item.id} onClick={() => onFormat(item.id)} className={`shrink-0 rounded-full border px-4 py-2 folio-ui focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${format === item.id ? 'border-folio-text-primary bg-folio-text-primary text-white' : 'border-folio-border-subtle hover:bg-surface-ground'}`}>{item.label}</button>)}</div>}
  </div>;
}

export function AboutMeInvitation({ compact = false, bio = false }: { compact?: boolean; bio?: boolean }) {
  return <article className={`flex flex-col rounded-xl bg-surface-ground p-6 ${compact ? 'order-first sm:order-none' : 'sm:p-8'}`}>
    <div><p className="folio-meta uppercase tracking-widest text-folio-text-secondary">About me · A guided interview</p><div className="my-4"><UserRound aria-hidden="true" className="h-7 w-7" /></div>
      <h3 className="folio-h3">{bio ? 'Give your bio a fresh perspective' : 'Meet the designer: 20 Questions'}</h3><p className="folio-body mt-3 text-folio-text-secondary">{bio ? 'A few thoughtful answers become an introduction in your voice. Give future clients a clearer picture of the person behind your work.' : 'Your eye, your favorites, your way of working. Make a personal Q&A to feature on your profile and share with the people who follow your work.'}</p>
    </div>
    <div className="mt-6"><Link className={studioAction} href={bio ? '/designer/studio/about-me?activity=bio' : '/designer/studio/activity?subject=designer&format=twenty_questions'}>{bio ? 'Shape my bio' : 'Start my 20 Questions'} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link><p className="folio-meta mt-3 text-folio-text-secondary">{bio ? 'Review every word before updating your profile.' : 'Short answers welcome. Save and return anytime.'}</p></div>
  </article>;
}

export function ActivityInvitations({ project, format = '', personal = false, omitTwenty = false }: { project?: DiscoveryProject; format?: string; personal?: boolean; omitTwenty?: boolean }) {
  const subject = project ? 'project' : 'designer';
  const activities = [
    { format: 'twenty_questions', title: project ? `20 Questions about ${project.title}` : 'Meet the designer: 20 Questions', detail: 'A personal Q&A, ready to feature on your profile and share.', action: 'Start 20 Questions' },
    { format: 'qa', title: project ? 'The room you’re still proud of' : 'What defines your design eye?', detail: project ? 'Choose a room and tell the story behind a decision that still matters.' : 'Five answers about the choices and influences behind your work.', action: 'Tell this story' },
    { format: 'material', title: 'A material you keep coming back to', detail: 'Explain its appeal through a real choice and what it made possible.', action: 'Explore a material' },
    { format: 'method', title: project ? 'How it came together' : 'How I work', detail: 'Take a reader from the first thought to the finished result.', action: 'Share my process' },
  ].filter(item => !(omitTwenty && item.format === 'twenty_questions')).filter(item => !format || item.format === format || (format === 'process' && item.format === 'method') || (format === 'room' && item.format === 'qa') || (format === 'project' && item.format === 'qa'));
  return <section aria-label={personal ? 'Make your profile yours' : 'Stories you can start'} className="space-y-5">
    <header><h2 className="folio-h2">{personal ? 'Make your profile yours' : project ? `More to say about ${project.title}` : 'Tell your story'}</h2><p className="folio-body mt-2 text-folio-text-secondary">{personal ? 'Let people meet the person behind the work. Each activity leaves you with something to show.' : 'Start with a few answers. Finish with a story in your own words.'}</p></header>
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {personal && !format && <AboutMeInvitation bio />}
      {activities.map(item => <article key={item.format} className="flex flex-col rounded-xl border border-folio-border-subtle p-6"><p className="folio-meta text-folio-text-secondary">{item.format === 'twenty_questions' ? '20' : '5'} questions · Interview to start</p><h3 className="folio-h3 mt-4">{item.title}</h3><p className="folio-body mt-3 text-folio-text-secondary">{item.detail}</p><Link className={`${studioAction} mt-6 self-start`} href={`/designer/studio/activity?${new URLSearchParams({ subject, format: item.format, ...(project ? { projectId: project.id, ...(item.format === 'qa' ? { chooseRoom: '1' } : {}) } : {}) })}`}>{item.action}</Link></article>)}
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
