'use client';

import { useState } from 'react';
import { StudioPhoto } from './StudioWorkspace';
import { StudioPitchDialog } from './StudioPitchCard';
import { StudioPublicationCard } from './StudioPublicationCard';
import { ActivityArticleCover } from './ActivityArticleCover';
import { activityOpportunity } from '@/lib/publishing-studio/opportunities';
import { activityHeadline } from '@/lib/publishing-studio/publication-headlines';
import type { PersonalIntroduction } from './usePersonalIntroduction';

export type DiscoveryProject = { id: string; title: string; thumbnail?: string | null };
export const storyFormats = [
  { id: '', label: 'All stories' }, { id: 'room', label: 'Room features' },
  { id: 'project', label: 'Project stories' }, { id: 'twenty_questions', label: '20 Questions' }, { id: 'material', label: 'Materials' },
  { id: 'process', label: 'Process' },
];

/** Subject and format are independent, visible choices. Selection never starts an activity. */
export function StudioDiscovery({ projects, subject, format, onSubject, onFormat, onClear }: {
  projects: DiscoveryProject[]; subject: string; format: string;
  onSubject(value: string): void; onFormat(value: string): void; onClear(): void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = projects.find(project => project.id === subject);
  const choices = projects.filter(project => project.title.toLowerCase().includes(search.trim().toLowerCase()));
  const choiceStyle = (active: boolean) => `rounded-full border px-4 py-2 folio-ui ${active ? 'border-folio-text-primary bg-folio-text-primary text-white' : 'border-folio-border-subtle'}`;
  return <div className="flex items-center gap-3 py-2">
    <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="folio-ui text-folio-text-secondary underline underline-offset-4">Filter{subject || format ? ' · Active' : ''}</button>
    {(subject || format) && <><span className="folio-meta text-folio-text-secondary">{selected?.title || (subject === 'about-me' ? 'About me' : '')}{format ? ` · ${storyFormats.find(item => item.id === format)?.label || format}` : ''}</span><button className="folio-meta underline" onClick={onClear}>Clear</button></>}
    {open && <StudioPitchDialog title="Filter publications" onClose={() => setOpen(false)}>
      <div className="space-y-6">
        <div role="group" aria-label="Story subject" className="flex flex-wrap gap-2"><button className={choiceStyle(!subject)} onClick={() => onSubject('')}>All work</button><button className={choiceStyle(subject === 'about-me')} onClick={() => onSubject('about-me')}>About me</button></div>
        <div role="group" aria-label="Story format" className="flex flex-wrap gap-2">{storyFormats.map(item => <button key={item.id} aria-pressed={format === item.id} className={choiceStyle(format === item.id)} onClick={() => onFormat(item.id)}>{item.label}</button>)}</div>
        <label className="block folio-ui">Project<input type="search" aria-label="Search projects" placeholder="Search projects" value={search} onChange={event => setSearch(event.target.value)} className="mt-2 w-full rounded-full border border-folio-border-subtle px-4 py-2" /></label>
        <div role="group" aria-label="Projects" className="grid grid-cols-2 gap-4 sm:grid-cols-3">{choices.map(project => <button key={project.id} aria-pressed={subject === project.id} onClick={() => onSubject(project.id)} className={`rounded-xl p-2 text-left ${subject === project.id ? 'ring-1 ring-folio-text-primary' : ''}`}>
          {project.thumbnail && <StudioPhoto images={[{id:project.id,url:project.thumbnail}]} alt={project.title} className="aspect-[4/3] rounded-lg" />}<span className="folio-ui mt-2 block">{project.title}</span>
        </button>)}</div>
        {!choices.length && <p className="folio-meta">No projects match this search.</p>}
        <button className="folio-ui rounded-full border border-folio-border-strong px-5 py-2" onClick={() => setOpen(false)}>Show publications</button>
      </div>
    </StudioPitchDialog>}
  </div>;
}

export function AboutMeInvitation({ compact = false, bio = false, introduction }: { compact?: boolean; bio?: boolean; introduction?: PersonalIntroduction | null }) {
  if (!introduction) return null;
  const opportunity = activityOpportunity(bio ? 'bio' : 'twenty_questions');
  const identity = introduction.identity || { name: 'The designer' };
  const published = !bio && introduction.status === 'published' && !introduction.needsReview;
  const draft = !bio && (introduction.status === 'draft' || introduction.needsReview);
  const article = introduction.stage === 'article';
  const title = !bio && introduction.title || activityHeadline(bio ? 'bio' : 'twenty_questions', identity.name);
  return <div className={compact ? 'min-w-0' : ''}><StudioPublicationCard
    title={title} preview={<ActivityArticleCover title={title} identity={identity} working={!published && !article} label={bio ? 'Profile introduction' : 'In conversation with Folio'} />}
    metadata={published ? 'Published on Folio' : draft ? 'Saved work' : 'Working preview'}
    benefit={bio ? 'Help the right clients understand your practice.' : 'Let potential clients meet the person behind your projects.'}
    contribution={published ? 'Your article is ready to share.' : draft ? article ? 'Review your article and approve it for publication.' : 'Continue your saved interview; your answers shape the article.' : bio ? 'Review your existing bio, then add your perspective.' : 'Answer a guided interview drawn from your bio and published work.'}
    actionLabel={!bio && introduction.needsReview ? 'Review sources' : published ? 'View my introduction' : draft ? article ? 'Review and publish' : 'Continue my interview' : 'Start my interview'}
    href={published ? introduction.publishedUrl || introduction.href : draft ? introduction.href : opportunity.href!}
    readiness={published ? 'published' : draft ? 'saved' : 'working'} />
  </div>;
}

export function ActivityInvitations({ project, format = '', personal = false, omitTwenty = false, introduction }: { project?: DiscoveryProject; format?: string; personal?: boolean; omitTwenty?: boolean; introduction?:PersonalIntroduction|null }) {
  // Specific project formats remain available through Filter; the default collection avoids duplicate generic prompts.
  const formats = (format ? ['twenty_questions', 'qa', 'material', 'method'] : project ? ['qa', 'material'] : ['twenty_questions']).filter(item => !(omitTwenty && item === 'twenty_questions')).filter(item => !format || item === format || (format === 'process' && item === 'method') || (format === 'room' && item === 'qa') || (format === 'project' && item === 'qa'));
  return <section aria-label={personal ? 'Make your profile yours' : 'Stories you can start'} className="space-y-5">
    <header><h2 className="folio-h2">{personal ? 'About me' : project ? `More from ${project.title}` : 'Tell your story'}</h2></header>
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {personal && !format && <AboutMeInvitation bio introduction={introduction} />}
      {formats.map(format => {
        if (format === 'twenty_questions' && !project) return <AboutMeInvitation key={format} introduction={introduction} />;
        const opportunity = activityOpportunity(format, project);
        const title = activityHeadline(format, introduction?.identity?.name || 'The designer', project?.title);
        return <StudioPublicationCard key={format} title={title}
          preview={<ActivityArticleCover title={title} identity={introduction?.identity || {name:'The designer'}} projectImageUrl={project ? project.thumbnail ?? null : undefined} working />}
          benefit={opportunity.purpose} contribution={project ? 'Which specific decision should readers understand? Choose an example to give this question its story.' : 'Your answers will give this open question its story.'}
          actionLabel="Start my interview" href={opportunity.href!} metadata={project?.title || 'Working preview'} readiness="working" supportingSources={project ? [project.id] : []} />;
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
