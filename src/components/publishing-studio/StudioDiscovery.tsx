'use client';

import { useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { StudioPhoto } from './StudioWorkspace';
import { StudioPitchCard } from './StudioPitchCard';
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
  const picker = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const pickerTitle = useId();
  const [search, setSearch] = useState('');
  const selected = projects.find(project => project.id === subject);
  const visibleProjects = projects.filter(project => project.title.toLowerCase().includes(search.trim().toLowerCase()));
  const choiceStyle = (active: boolean) => `rounded-full border px-4 py-2.5 folio-ui transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${active ? 'border-folio-text-primary bg-folio-text-primary text-white' : 'border-folio-border-subtle hover:bg-surface-ground'}`;
  return <div className="space-y-4 border-y border-folio-border-subtle py-5">
    <div role="group" aria-label="Story subject" className="flex flex-wrap items-center gap-2">
      <button type="button" aria-pressed={!subject} onClick={() => onSubject('')} className={choiceStyle(!subject)}>All work</button>
      <button type="button" aria-pressed={subject === 'about-me'} onClick={() => onSubject('about-me')} className={choiceStyle(subject === 'about-me')}>About me</button>
      <button type="button" aria-haspopup="dialog" onClick={() => { setSearch(''); picker.current?.showModal(); searchInput.current?.focus(); }} className={choiceStyle(Boolean(selected))}>{selected ? 'Change project' : 'Choose project'}</button>
      {selected && <span className="flex min-w-0 items-center gap-2 pl-1 folio-ui"><span className="max-w-64 truncate" title={selected.title}>{selected.title}</span><button type="button" aria-label="Clear project selection" onClick={() => onSubject('')} className="rounded-full p-2 hover:bg-surface-ground"><X className="h-4 w-4" aria-hidden="true" /></button></span>}
    </div>
    {subject !== 'about-me' && <div role="group" aria-label="Story format" className="flex flex-wrap gap-2">{storyFormats.map(item => <button key={item.id} type="button" aria-pressed={format === item.id} onClick={() => onFormat(item.id)} className={`rounded-md px-3 py-2 folio-ui focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${format === item.id ? 'bg-surface-ground text-folio-text-primary underline underline-offset-4' : 'text-folio-text-secondary hover:bg-surface-ground'}`}>{item.label}</button>)}</div>}
    <dialog ref={picker} aria-labelledby={pickerTitle} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl rounded-2xl bg-white p-0 text-folio-text-primary shadow-xl backdrop:bg-black/40" onClick={event => { if (event.target === event.currentTarget) picker.current?.close(); }}>
      <div className="p-5 sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-4"><h2 id={pickerTitle} className="folio-h2">Choose a project</h2><button type="button" aria-label="Close project picker" onClick={() => picker.current?.close()} className="rounded-full p-2 hover:bg-surface-ground"><X className="h-5 w-5" aria-hidden="true" /></button></div>
        <label className="mb-6 flex items-center gap-3 rounded-full border border-folio-border-subtle px-4 py-3"><Search className="h-4 w-4 text-folio-text-secondary" aria-hidden="true" /><span className="sr-only">Search projects</span><input ref={searchInput} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search projects" className="min-w-0 flex-1 bg-transparent folio-ui outline-none" /></label>
        <div role="group" aria-label="Projects" className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {visibleProjects.map(project => <button type="button" key={project.id} aria-pressed={subject === project.id} onClick={() => { onSubject(project.id); picker.current?.close(); }} className={`rounded-xl p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${subject === project.id ? 'bg-surface-ground ring-1 ring-folio-text-primary' : 'hover:bg-surface-ground'}`}>
            {project.thumbnail ? <StudioPhoto images={[{ id: project.id, url: project.thumbnail }]} alt="" className="aspect-[4/3] rounded-lg" /> : <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-surface-elevated"><span className="folio-h2" aria-hidden="true">{project.title.slice(0, 1)}</span></div>}
            <span className="mt-2 block folio-ui">{project.title}</span>
          </button>)}
        </div>
        {!visibleProjects.length && <p className="py-8 text-center folio-body text-folio-text-secondary">{projects.length ? 'No projects match your search.' : 'Your projects will appear here.'}</p>}
      </div>
    </dialog>
  </div>;
}

function PersonalCover({ label, detail, tall = false }: { label: string; detail: string; tall?: boolean }) {
  return <div aria-hidden="true" className={`flex flex-col justify-between bg-surface-ground p-6 sm:p-8 ${tall ? 'aspect-[4/5]' : 'aspect-[4/3]'}`}><span className="folio-meta uppercase tracking-widest text-folio-text-secondary">{detail}</span><span className="folio-h1 leading-none">{label}</span><span className="h-px w-12 bg-folio-text-secondary" /></div>;
}

export function AboutMeInvitation({ compact = false, bio = false, introduction }: { compact?: boolean; bio?: boolean; introduction?: PersonalIntroduction | null }) {
  if (!bio && !introduction) return null;
  const opportunity = activityOpportunity(bio ? 'bio' : 'twenty_questions');
  const published = !bio && introduction?.status === 'published' && !introduction.needsReview;
  const draft = !bio && (introduction?.status === 'draft' || introduction?.needsReview);
  return <div className={compact ? 'order-first sm:order-none' : ''}><StudioPitchCard
    eyebrow={bio ? 'Profile bio' : published ? '20 Questions · Published' : draft ? '20 Questions · In progress' : '20 Questions'}
    title={published ? 'Your introduction is ready to share.' : draft ? 'Keep shaping your introduction.' : bio ? 'Help the right clients find you.' : 'Meet the person behind the projects.'}
    image={<PersonalCover tall={compact} label={bio ? 'In your words.' : 'Meet me.'} detail={bio ? 'Your practice' : '20 Questions'} />}
    actionLabel={published ? 'View my introduction' : draft ? 'Continue my introduction' : opportunity.action}
    href={published ? introduction?.publishedUrl || introduction?.href || '/designer/studio?tab=progress' : draft ? introduction?.href || '/designer/studio?tab=progress' : opportunity.href!}>
    <p>{published ? 'Your published article gives readers a way to meet the person behind the work.' : opportunity.reason}</p>
    {!published && <p>{draft ? 'Return to your saved answers, then review and edit the article.' : opportunity.path} {opportunity.result}</p>}
    <p>{published ? 'Published on your Folio profile · Share the article link' : opportunity.destination}</p>
    <p className="folio-meta">{opportunity.metadata}</p>
  </StudioPitchCard></div>;
}

export function ActivityInvitations({ project, format = '', personal = false, omitTwenty = false, introduction }: { project?: DiscoveryProject; format?: string; personal?: boolean; omitTwenty?: boolean; introduction?:PersonalIntroduction|null }) {
  const formats = ['twenty_questions', 'qa', 'material', 'method'].filter(item => !(omitTwenty && item === 'twenty_questions')).filter(item => !format || item === format || (format === 'process' && item === 'method') || (format === 'room' && item === 'qa') || (format === 'project' && item === 'qa'));
  return <section aria-label={personal ? 'Make your profile yours' : 'Stories you can start'} className="space-y-5">
    <header><h2 className="folio-h2">{personal ? 'About me' : project ? `More from ${project.title}` : 'Tell your story'}</h2></header>
    <div className={`grid gap-5 sm:grid-cols-2 ${personal ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {personal && !format && <AboutMeInvitation bio />}
      {formats.map(format => {
        if (format === 'twenty_questions' && !project) return <AboutMeInvitation key={format} introduction={introduction} />;
        const opportunity = activityOpportunity(format, project);
        const label = format === 'material' ? 'Material choices' : format === 'method' ? 'My process' : format === 'twenty_questions' ? '20 Questions' : project ? 'Room Q&A' : 'My perspective';
        const cover = format === 'material' ? 'Why this?' : format === 'method' ? 'How I work.' : format === 'twenty_questions' ? 'The story within.' : 'Through my eyes.';
        const title = format === 'material' ? 'The thinking behind a material choice.' : format === 'method' ? 'What working with you feels like.' : format === 'twenty_questions' ? `Get to know ${project?.title}.` : project ? 'A room worth a closer look.' : 'What you notice—and why.';
        return <StudioPitchCard key={format} eyebrow={label} title={title}
          image={project?.thumbnail ? <StudioPhoto images={[{ id: project.id, url: project.thumbnail }]} alt="" className="aspect-[4/3]" /> : <PersonalCover label={cover} detail={label} />}
          actionLabel={opportunity.action} href={opportunity.href!}>
          <p>{opportunity.reason}</p><p>{opportunity.path}</p><p>{opportunity.result} {opportunity.destination}</p><p className="folio-meta">{opportunity.metadata}</p>
        </StudioPitchCard>;
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
