'use client';
import { useState } from 'react';
import { activityFormatsFor, type ActivityBrief, type ActivityContext } from '@/lib/publishing-studio/activities';

export function StoryConfigurator({ brief, context, pending, onChange, onStart }: {
  brief: ActivityBrief; context: ActivityContext; pending: boolean;
  onChange(brief: ActivityBrief): void; onStart(): void;
}) {
  const [step, setStep] = useState<'topic' | 'format'>('topic');
  const project = context.projects.find(item => item.id === brief.projectId);
  const choice = (selected: boolean) => `rounded-xl border p-5 text-left ${selected ? 'border-folio-text-primary bg-surface-muted' : 'border-folio-border-subtle'}`;
  const pill = (selected: boolean) => `rounded-full border px-5 py-3 folio-ui ${selected ? 'border-folio-text-primary bg-folio-text-primary text-white' : 'border-folio-border-subtle'}`;
  return <div className="space-y-6">
    <nav aria-label="Story setup" className="flex flex-wrap items-center gap-4 border-b border-folio-border-subtle pb-4 folio-ui">
      <button disabled={pending} aria-current={step === 'topic' ? 'step' : undefined} onClick={() => setStep('topic')}>1. Topic</button><span aria-hidden="true">→</span>
      <button disabled={pending || (brief.subject === 'project' && !project)} aria-current={step === 'format' ? 'step' : undefined} onClick={() => setStep('format')}>2. Story type</button><span aria-hidden="true">→</span><span className="text-folio-text-secondary">3. Interview</span>
    </nav>
    <p className="folio-body text-folio-text-secondary">A story for Folio and Instagram, shaped around your background and work.</p>
    {step === 'topic' ? <>
      <fieldset><legend className="folio-h3 mb-4">Topic</legend><div className="grid gap-4 min-[480px]:grid-cols-3">
        {([['designer', 'Designer', 'Your eye, references and everyday favorites.'], ['firm', 'Firm History', 'The people and moments behind the practice.'], ['project', 'Specific Project', 'The whole project, or a closer look at one room.']] as const).map(([subject, label, description]) => <button key={subject} aria-pressed={brief.subject === subject} className={choice(brief.subject === subject)} onClick={() => onChange({ subject, format: activityFormatsFor(subject)[0].key })}><span className="folio-h4 block">{label}</span><span className="folio-body mt-2 block text-folio-text-secondary">{description}</span></button>)}
      </div></fieldset>
      {brief.subject === 'project' && <fieldset><legend className="folio-h4 mb-3">Project</legend><div className="flex flex-wrap gap-3">{context.projects.map(item => <button key={item.id} aria-pressed={brief.projectId === item.id} className={pill(brief.projectId === item.id)} onClick={() => onChange({ ...brief, projectId: item.id, roomId: undefined })}>{item.title}</button>)}</div>{!context.projects.length && <p className="folio-body">Your available projects will appear here.</p>}</fieldset>}
      {project && <fieldset><legend className="folio-h4 mb-3">Focus</legend><div className="flex flex-wrap gap-3"><button aria-pressed={!brief.roomId} className={pill(!brief.roomId)} onClick={() => onChange({ ...brief, roomId: undefined })}>Whole project</button>{project.rooms.map(room => <button key={room.id} aria-pressed={brief.roomId === room.id} className={pill(brief.roomId === room.id)} onClick={() => onChange({ ...brief, roomId: room.id })}>{room.name}</button>)}</div></fieldset>}
      <button className={pill(true)} disabled={brief.subject === 'project' && !project} onClick={() => setStep('format')}>Next: Story type</button>
    </> : <>
      <fieldset disabled={pending}><legend className="folio-h3 mb-4">Story type</legend><div className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">{activityFormatsFor(brief.subject).map(({ key, ...format }) => <button key={key} aria-pressed={brief.format === key} className={choice(brief.format === key)} onClick={() => onChange({ ...brief, format: key })}><span className="folio-h4 block">{format.label}</span><span className="folio-body mt-2 block text-folio-text-secondary">{format.description}</span></button>)}</div></fieldset>
      <p className="folio-body text-folio-text-secondary">We’ll use your bio and relevant project history to prepare the questions. You bring the answers.</p>
      <div className="flex flex-wrap gap-3"><button disabled={pending} className={pill(false)} onClick={() => setStep('topic')}>Back to Topic</button><button disabled={pending} className={pill(true)} onClick={onStart}>{pending ? 'Shaping your questions…' : 'Prepare my interview'}</button></div>
    </>}
  </div>;
}
