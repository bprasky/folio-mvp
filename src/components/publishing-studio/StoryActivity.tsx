'use client';

import { useState } from 'react';
import {
  ACTIVITY_FORMATS, createActivity, activityProgress, prepareActivityDraft, profileActivitySuggestions,
  type ActivityAnswer, type ActivityBrief, type ActivityContext, type ActivityDefinition, type ActivityDraft, type ActivityFormat,
} from '@/lib/publishing-studio/activities';

export interface ActivitySnapshot {
  id: string;
  revision: number;
  definition: ActivityDefinition;
  answers: ActivityAnswer[];
  reviewed: boolean;
  draft: ActivityDraft | null;
}
/** The server adapter must enforce identity, expected revision and answer review atomically. */
export interface ActivityPersistence {
  create(brief: ActivityBrief): Promise<ActivitySnapshot>;
  save(snapshot: ActivitySnapshot): Promise<ActivitySnapshot>;
}
const field = 'w-full rounded-xl border border-folio-border-subtle bg-surface-canvas px-4 py-3 folio-body';
const action = 'rounded-full bg-folio-text-primary px-5 py-3 folio-ui text-white disabled:opacity-40';
const secondary = 'rounded-full border border-folio-border-subtle px-5 py-3 folio-ui disabled:opacity-40';

export function StoryActivity({ context, persistence, initial, onClose }: {
  context: ActivityContext; persistence: ActivityPersistence; initial?: ActivitySnapshot; onClose(): void;
}) {
  const [brief, setBrief] = useState<ActivityBrief>({ subject: 'designer', format: 'twenty_questions', topic: '', destinations: ['folio', 'instagram'] });
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | undefined>(initial);
  const [step, setStep] = useState<'configure' | 'interview' | 'review' | 'draft'>(initial?.draft ? 'draft' : initial ? 'interview' : 'configure');
  const [index, setIndex] = useState(() => Math.max(0, initial?.definition.questions.findIndex(question => !initial.answers.some(answer => answer.questionId === question.id && answer.text.trim())) ?? 0));
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const project = context.projects.find(item => item.id === brief.projectId);
  const progress = snapshot ? activityProgress(snapshot.definition, snapshot.answers) : null;
  const question = snapshot?.definition.questions[index];
  const answer = snapshot?.answers.find(item => item.questionId === question?.id)?.text || '';

  async function start() {
    setError(''); setPending(true);
    try {
      createActivity(brief, context); // Immediate helpful errors; the server independently validates.
      const saved = await persistence.create(brief);
      setSnapshot(saved); setStep('interview'); setIndex(0); setDirty(false); setNotice('Activity started.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the activity.'); }
    finally { setPending(false); }
  }
  function edit(text: string) {
    if (!snapshot || !question) return;
    setSnapshot({ ...snapshot, reviewed: false, draft: null,
      answers: [...snapshot.answers.filter(item => item.questionId !== question.id), { questionId: question.id, text }] });
    setDirty(true); setNotice('');
  }
  async function save(next: ActivitySnapshot | undefined = snapshot) {
    if (!next) return false;
    setError(''); setNotice(''); setPending(true);
    try { setSnapshot(await persistence.save(next)); setDirty(false); setNotice('Progress saved.'); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Your answers are still here.'); return false; }
    finally { setPending(false); }
  }
  async function prepare() {
    if (!snapshot) return;
    try {
      const draft = prepareActivityDraft(snapshot.definition, snapshot.answers, snapshot.reviewed);
      if (await save({ ...snapshot, draft })) setStep('draft');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Finish reviewing your answers first.'); }
  }
  async function close() {
    if (dirty && !await save()) return;
    onClose();
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('Copied.'); }
    catch { setError('Could not copy. You can select the text below.'); }
  }

  return <section aria-label="Story activity" className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="folio-meta text-folio-text-secondary">Publishing Studio</p><h1 className="folio-h2 mt-2">{snapshot?.definition.title || 'Build a story'}</h1></div>
      <button className={secondary} disabled={pending} onClick={close}>{snapshot ? 'Save & return to Studio' : 'Back to Studio'}</button>
    </header>
    {error && <p role="alert" className="mb-4 folio-body">{error}</p>}
    {notice && <p role="status" className="mb-4 folio-meta">{notice}</p>}
    {step === 'configure' && <div className="space-y-6">
      <p className="folio-body text-folio-text-secondary">Choose a direction. Folio will walk you through the questions before you shape the post.</p>
      {profileActivitySuggestions(context).length > 0 && <aside className="rounded-xl bg-surface-muted p-4"><h2 className="folio-h4">A useful place to start</h2>
        {profileActivitySuggestions(context).map(suggestion => <div key={suggestion.label} className="mt-3"><button className="folio-ui underline underline-offset-4" onClick={() => setBrief({ ...brief, subject: suggestion.subject, format: suggestion.format, projectId: undefined, roomId: undefined })}>{suggestion.label}</button><p className="folio-meta mt-1 text-folio-text-secondary">{suggestion.reason}</p></div>)}
      </aside>}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 folio-ui">Who or what is the story about?
          <select className={field} value={brief.subject} onChange={event => setBrief({ ...brief, subject: event.target.value as ActivityBrief['subject'], projectId: undefined, roomId: undefined, format: brief.format === 'history' ? 'qa' : brief.format })}>
            <option value="designer">Me as a designer</option><option value="firm">The firm</option><option value="project">A project</option>
          </select>
        </label>
        {brief.subject === 'project' && <label className="grid gap-2 folio-ui">Project<select className={field} value={brief.projectId || ''} onChange={event => setBrief({ ...brief, projectId: event.target.value || undefined, roomId: undefined })}><option value="">Choose a project</option>{context.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
        {project && <label className="grid gap-2 folio-ui">Focus<select className={field} value={brief.roomId || ''} onChange={event => setBrief({ ...brief, roomId: event.target.value || undefined })}><option value="">The project as a whole</option>{project.rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>}
      </div>
      <fieldset><legend className="folio-h4 mb-3">What kind of story?</legend><div className="grid gap-3 sm:grid-cols-2">{Object.entries(ACTIVITY_FORMATS).filter(([key]) => key !== 'history' || brief.subject === 'firm').map(([key, format]) =>
        <label key={key} className="flex items-start gap-3 rounded-xl border border-folio-border-subtle p-4"><input className="mt-1" type="radio" name="activity-format" value={key} checked={brief.format === key} onChange={() => setBrief({ ...brief, format: key as ActivityFormat })} /><span><span className="folio-ui">{format.label}</span><span className="mt-1 block folio-meta text-folio-text-secondary">{format.description}</span></span></label>)}</div></fieldset>
      <label className="grid gap-2 folio-ui">{brief.format === 'material' ? 'Which material or material decision?' : 'A particular angle? (optional)'}<input className={field} maxLength={160} value={brief.topic} onChange={event => setBrief({ ...brief, topic: event.target.value })} placeholder={brief.format === 'material' ? 'For example, choosing stone for the kitchen' : 'For example, how we approach a first meeting'} /></label>
      <fieldset><legend className="folio-h4 mb-3">Prepare it for</legend><div className="flex flex-wrap gap-5">{(['folio', 'instagram', 'linkedin'] as const).map(destination => <label key={destination} className="flex items-center gap-2 folio-ui"><input type="checkbox" checked={brief.destinations.includes(destination)} onChange={event => setBrief({ ...brief, destinations: event.target.checked ? [...brief.destinations, destination] : brief.destinations.filter(item => item !== destination) })} />{destination === 'folio' ? 'Folio' : destination === 'instagram' ? 'Instagram' : 'LinkedIn'}</label>)}</div><p className="folio-meta mt-3 text-folio-text-secondary">This prepares drafts. Nothing is published or sent to social accounts.</p></fieldset>
      <button className={action} disabled={pending} onClick={start}>{pending ? 'Starting…' : 'Start the interview'}</button>
    </div>}
    {snapshot && step === 'interview' && question && <div className="space-y-5">
      <p className="folio-body text-folio-text-secondary">{snapshot.definition.intro}</p>
      <div className="flex flex-wrap justify-between gap-2 folio-meta"><span>{snapshot.definition.subjectLabel}{snapshot.definition.brief.topic ? ` · ${snapshot.definition.brief.topic}` : ''}</span><span>{progress!.answered} of {progress!.total} answered{dirty ? ' · Unsaved changes' : ''}</span></div>
      <progress className="w-full" max={progress!.total} value={progress!.answered} aria-label="Interview progress" />
      <p className="folio-meta">Question {index + 1} of {progress!.total}</p>
      <label className="grid gap-4"><span className="folio-h3">{question.prompt}</span><textarea className={`${field} min-h-48`} maxLength={8000} disabled={pending} value={answer} onChange={event => edit(event.target.value)} placeholder="Your answer, in your own words" /></label>
      <p className="folio-meta text-folio-text-secondary">{question.hint}</p>
      <div className="flex flex-wrap gap-3"><button className={secondary} disabled={pending || index === 0} onClick={() => setIndex(index - 1)}>Previous</button><button className={secondary} disabled={pending} onClick={() => save()}>{pending ? 'Saving…' : 'Save progress'}</button>
        {index < progress!.total - 1 ? <button className={action} disabled={pending} onClick={() => setIndex(index + 1)}>{answer.trim() ? 'Next question' : 'Come back to this'}</button> : <button className={action} disabled={pending} onClick={() => setStep('review')}>Review answers</button>}
      </div>
      <button className="folio-meta underline underline-offset-4" disabled={pending} onClick={() => setStep('review')}>See all questions and answers</button>
    </div>}
    {snapshot && step === 'review' && <div className="space-y-5">
      <h2 className="folio-h3">Your answers</h2><p className="folio-body">{progress!.answered} of {progress!.total} answered. Your words will form the draft; unanswered questions will never be filled in for you.</p>
      <ol className="space-y-5">{snapshot.definition.questions.map((item, questionIndex) => <li key={item.id} className="rounded-xl border border-folio-border-subtle p-4"><h3 className="folio-ui">{questionIndex + 1}. {item.prompt}</h3><p className="folio-body mt-2 whitespace-pre-wrap">{snapshot.answers.find(entry => entry.questionId === item.id)?.text || 'Not answered yet'}</p>{progress!.needsDetail.includes(item.id) && <p className="folio-meta mt-2">Would a concrete example help the reader picture this?</p>}<button disabled={pending} className="folio-meta mt-3 underline underline-offset-4" onClick={() => { setIndex(questionIndex); setStep('interview'); }}>Edit answer {questionIndex + 1}</button></li>)}</ol>
      <label className="flex items-start gap-3 folio-body"><input type="checkbox" className="mt-1" disabled={pending} checked={snapshot.reviewed} onChange={event => { setSnapshot({ ...snapshot, reviewed: event.target.checked }); setDirty(true); }} />I have reviewed these answers and want to use them to prepare a draft.</label>
      {!progress!.ready && <p className="folio-meta">Finish the unanswered questions before preparing this format.</p>}
      <button className={action} disabled={pending || !progress!.ready || !snapshot.reviewed} onClick={prepare}>{pending ? 'Saving…' : 'Prepare my draft'}</button>
    </div>}
    {snapshot?.draft && step === 'draft' && <div className="space-y-6">
      <p className="folio-meta">Draft preview · Not published</p><h2 className="folio-h3">Ready to shape from your answers</h2>
      <p className="folio-body text-folio-text-secondary">Your original answers are preserved. Choose an opening answer for the social version, or review the full Q&A.</p>
      {snapshot.definition.brief.destinations.includes('folio') && <section aria-label="Folio draft"><h3 className="folio-h4">Folio Q&A</h3><button className={`${secondary} my-3`} onClick={() => copy(`${snapshot.draft!.title}\n\n${snapshot.draft!.entries.map(entry => `${entry.question}\n${entry.answer}`).join('\n\n')}`)}>Copy Q&A</button><div className="space-y-4">{snapshot.draft.entries.map(entry => <div key={entry.questionId}><h4 className="folio-ui">{entry.question}</h4><p className="folio-body mt-1 whitespace-pre-wrap">{entry.answer}</p></div>)}</div></section>}
      {snapshot.definition.brief.destinations.some(item => item !== 'folio') && <section aria-label="Social draft options"><h3 className="folio-h4">An answer to lead with</h3><p className="folio-meta mt-2">Question-and-answer excerpts for {snapshot.definition.brief.destinations.filter(item => item !== 'folio').map(item => item === 'instagram' ? 'Instagram' : 'LinkedIn').join(' and ')}. Add images and refine the format next.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{snapshot.draft.socialOptions.map(option => <article key={option.questionId} className="rounded-xl border border-folio-border-subtle p-4"><p className="folio-body whitespace-pre-wrap">{option.text}</p><button className="folio-meta mt-3 underline underline-offset-4" onClick={() => copy(option.text)}>Copy excerpt</button></article>)}</div>{!snapshot.draft.socialOptions.length && <p className="folio-body mt-3">These answers need a shorter excerpt before a social version can be prepared.</p>}</section>}
      <button className={secondary} onClick={() => setStep('review')}>Review or edit answers</button>
    </div>}
  </section>;
}
