'use client';

import { ActivityArticleCover } from './ActivityArticleCover';
import { useState } from 'react';
import { activityOpportunity } from '@/lib/publishing-studio/opportunities';
import { StoryConfigurator } from './StoryConfigurator';
import { useActivityExit } from './UnsavedActivityDialog';
import { ActivitySocialCard } from './ActivitySocialCard';
import {
  createActivity, activityProgress, prepareActivityDraft, editActivityDraft,
  ACTIVITY_FORMATS, type ActivityAnswer, type ActivityBrief, type ActivityContext, type ActivityDefinition, type ActivityDraft,
} from '@/lib/publishing-studio/activities';

export interface ActivitySnapshot {
  id: string;
  revision: number;
  definition: ActivityDefinition;
  answers: ActivityAnswer[];
  reviewed: boolean;
  articleReviewed?: boolean;
  publicationNeedsReview?: boolean;
  profileUrl?: string | null;
  draft: ActivityDraft | null;
  publishedUrl?: string | null;
  previousPublishedUrl?: string | null;
  status?: string;
}
/** The server adapter must enforce identity, expected revision and answer review atomically. */
export interface ActivityPersistence {
  create(brief: ActivityBrief): Promise<ActivitySnapshot>;
  save(snapshot: ActivitySnapshot): Promise<ActivitySnapshot>;
  publish?(snapshot: ActivitySnapshot): Promise<ActivitySnapshot>;
}
const answerKey = (answers: ActivityAnswer[]) => JSON.stringify(answers.filter(answer => answer.text !== '').map(answer => ({ questionId: answer.questionId, text: answer.text })).sort((a, b) => a.questionId.localeCompare(b.questionId)));
const field = 'w-full rounded-xl border border-folio-border-subtle bg-surface-canvas px-4 py-3 folio-body';
const action = 'rounded-full bg-folio-text-primary px-5 py-3 folio-ui text-white disabled:opacity-40';
const secondary = 'rounded-full border border-folio-border-subtle px-5 py-3 folio-ui disabled:opacity-40';

export function StoryActivity({ context, persistence, initial, initialBrief, chooseRoom = false, onClose }: {
  context: ActivityContext; persistence: ActivityPersistence; initial?: ActivitySnapshot; initialBrief?: ActivityBrief; chooseRoom?: boolean; onClose(): void;
}) {
  const [brief, setBrief] = useState<ActivityBrief>(initialBrief || { subject: 'designer', format: 'twenty_questions' });
  const [customize, setCustomize] = useState(!initialBrief);
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | undefined>(initial);
  const [step, setStep] = useState<'configure' | 'interview' | 'review' | 'draft'>(initial?.draft ? initial.reviewed ? 'draft' : 'review' : initial ? 'interview' : 'configure');
  const [index, setIndex] = useState(() => Math.max(0, initial?.definition.questions.findIndex(question => !initial.answers.some(answer => answer.questionId === question.id && answer.text.trim())) ?? 0));
  const [pending, setPending] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState(answerKey(initial?.answers || []));
  const [savedReviewed, setSavedReviewed] = useState(initial?.reviewed || false);
  const [savedDraft, setSavedDraft] = useState(JSON.stringify(initial?.draft || null));
  const dirty = !!snapshot && (answerKey(snapshot.answers) !== savedAnswers || snapshot.reviewed !== savedReviewed || JSON.stringify(snapshot.draft) !== savedDraft);
  const activeBrief = snapshot?.definition.brief || brief;
  const opportunity = activityOpportunity(activeBrief.format, activeBrief.subject === 'project' ? context.projects.find(project => project.id === activeBrief.projectId) : undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const progress = snapshot ? activityProgress(snapshot.definition, snapshot.answers) : null;
  const question = snapshot?.definition.questions[index];
  const answer = snapshot?.answers.find(item => item.questionId === question?.id)?.text || '';
  const exit = useActivityExit(dirty, pending, () => save());

  async function start() {
    setError(''); setPending(true);
    try {
      createActivity(brief, context); // Immediate helpful errors; the server independently validates.
      const saved = await persistence.create(brief);
      if (saved.definition.questionSource !== 'personalized' || saved.definition.questions.some(question => !question.prompt.trim())) throw new Error('Your questions are not ready yet. Try preparing the interview again.');
      setSnapshot(saved); setStep(saved.draft ? saved.reviewed ? 'draft' : 'review' : 'interview'); setIndex(Math.max(0, saved.definition.questions.findIndex(q => !saved.answers.some(a => a.questionId === q.id && a.text.trim())))); setSavedDraft(JSON.stringify(saved.draft)); setSavedAnswers(answerKey(saved.answers)); setSavedReviewed(saved.reviewed); setNotice('Activity started.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the activity.'); }
    finally { setPending(false); }
  }
  function edit(text: string) {
    if (!snapshot || !question) return;
    if (text === answer) return;
    setSnapshot({ ...snapshot, reviewed: false, articleReviewed: false, draft: null,
      answers: [...snapshot.answers.filter(item => item.questionId !== question.id), { questionId: question.id, text }] });
    setNotice('');
  }
  function editArticle(draft: ActivityDraft) {
    if (!snapshot) return;
    const socialOptions = draft.entries.filter(entry => entry.answer.trim().length <= 1800).map(entry => ({ questionId: entry.questionId, text: `${entry.question}\n\n${entry.answer}` }));
    setSnapshot({ ...snapshot, draft: { ...draft, socialOptions }, articleReviewed: false });
    setNotice('');
  }
  async function save(next: ActivitySnapshot | undefined = snapshot) {
    if (!next) return false;
    try { if (next.draft) editActivityDraft(next.definition, next.draft); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check your article text.'); return false; }
    setError(''); setNotice(''); setPending(true);
    try { const saved = await persistence.save(next); setSnapshot(saved); setSavedAnswers(answerKey(saved.answers)); setSavedReviewed(saved.reviewed); setSavedDraft(JSON.stringify(saved.draft)); setNotice('Draft saved.'); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Your answers are still here.'); return false; }
    finally { setPending(false); }
  }
  async function prepare() {
    if (!snapshot) return;
    try {
      if (!snapshot.reviewed) throw new Error('Review your answers before preparing the draft.');
      const draft = snapshot.draft || prepareActivityDraft(snapshot.definition, snapshot.answers, snapshot.reviewed);
      if (await save({ ...snapshot, draft })) setStep('draft');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Finish reviewing your answers first.'); }
  }
  async function close() {
    exit.requestExit(onClose);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('Copied.'); }
    catch { setError('Could not copy. You can select the text below.'); }
  }
  async function publish() {
    if (!snapshot || !persistence.publish || dirty || !snapshot.reviewed || !snapshot.articleReviewed) return;
    setPending(true); setError('');
    try { setSnapshot(await persistence.publish(snapshot)); setNotice('Your article is published.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not publish your article.'); }
    finally { setPending(false); }
  }

  return <section aria-label="Story activity" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    {exit.dialog}
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="folio-meta text-folio-text-secondary">Publishing Studio</p><h1 className="folio-h2 mt-2">{customize && !snapshot ? 'Build a story' : opportunity.purpose}</h1><p className="folio-meta mt-3 text-folio-text-secondary">{opportunity.metadata}</p></div>
      <button className={secondary} disabled={pending} onClick={close}>Back to Studio</button>
    </header>
    <details className="mb-6"><summary className="folio-ui cursor-pointer underline underline-offset-4">Publication preview</summary><div className="mt-4 max-w-md"><ActivityArticleCover title={snapshot?.draft?.title || snapshot?.definition.title || (brief.format === 'twenty_questions' ? `Meet ${context.designerName}` : opportunity.purpose)} identity={context.identity || {name:context.designerName}} working={!snapshot?.draft} /></div></details>
    {error && <p role="alert" className="mb-4 folio-body">{error}</p>}
    {notice && <p role="status" className="mb-4 folio-meta">{notice}</p>}
    {step === 'configure' && (customize ? <StoryConfigurator brief={brief} context={context} pending={pending} onChange={setBrief} onStart={start} /> : <div className="rounded-2xl border border-folio-border-subtle bg-surface-muted p-6 sm:p-8">
      <h2 className="folio-h3">{ACTIVITY_FORMATS[brief.format].label}</h2>
      <p className="folio-body my-4">{opportunity.reason} {opportunity.path}</p>
      <p className="folio-meta mb-6">{opportunity.result} {opportunity.destination} Questions draw on your bio and relevant published work; your answers supply your perspective.</p>
      {chooseRoom && brief.subject === 'project' && <fieldset className="mb-6"><legend className="folio-h4 mb-3">Choose a room or the whole project</legend><div className="flex flex-wrap gap-3"><button disabled={pending} className={secondary} aria-pressed={!brief.roomId} onClick={() => setBrief({ ...brief, roomId: undefined })}>Whole project</button>{context.projects.find(project => project.id === brief.projectId)?.rooms.map(room => <button key={room.id} disabled={pending} className={secondary} aria-pressed={brief.roomId === room.id} onClick={() => setBrief({ ...brief, roomId: room.id })}>{room.name}</button>)}</div></fieldset>}
      <div className="flex flex-wrap gap-3"><button className={action} disabled={pending} onClick={start}>{pending ? 'Shaping your questions…' : brief.format === 'twenty_questions' ? 'Start my 20 Questions' : 'Start my interview'}</button><button className={secondary} disabled={pending} onClick={() => setCustomize(true)}>Change topic or format</button></div>
    </div>)}
    {snapshot && step === 'interview' && question && <div className="space-y-5">
      <p className="folio-body text-folio-text-secondary">{snapshot.definition.intro}</p>
      <div className="flex flex-wrap justify-between gap-2 folio-meta"><span>{snapshot.definition.subjectLabel}</span><span>{progress!.answered} of {progress!.total} answered{dirty ? ' · Unsaved changes' : ''}</span></div>
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
      <label className="flex items-start gap-3 folio-body"><input type="checkbox" className="mt-1" disabled={pending} checked={snapshot.reviewed} onChange={event => { setSnapshot({ ...snapshot, reviewed: event.target.checked, articleReviewed: false }); }} />I have reviewed these answers and want to use them to prepare a draft.</label>
      {!progress!.ready && <p className="folio-meta">Finish the unanswered questions before preparing this format.</p>}
      <button className={action} disabled={pending || !progress!.ready || !snapshot.reviewed} onClick={prepare}>{pending ? 'Saving…' : 'Prepare my draft'}</button>
    </div>}
    {snapshot?.draft && step === 'draft' && <div className="space-y-6">
      <p className="folio-meta">{snapshot.publicationNeedsReview ? 'Saved article · Source review needed' : snapshot.publishedUrl ? 'Published article' : 'Draft preview · Not published'}</p><h2 className="folio-h3">Your story, in your words</h2>
      {snapshot.publicationNeedsReview && <p role="alert" className="folio-body">A source has changed or is no longer public. This saved article is preserved, but its public link is unavailable. Review the source work before sharing.</p>}
      {persistence.publish && !snapshot.publicationNeedsReview && <section className="rounded-xl border border-folio-border-subtle p-5">{snapshot.publishedUrl ? <><a href={snapshot.publishedUrl} className={action}>View my article</a><button className={`${secondary} ml-3`} onClick={() => copy(new URL(snapshot.publishedUrl!, window.location.origin).href)}>Copy article link</button><p className="folio-body mt-4">Your article is also in your profile’s About section. Share its link with clients or on Instagram.</p>{snapshot.profileUrl && <a href={snapshot.profileUrl} className="folio-ui mt-3 inline-block underline">View my About section</a>}</> : <><p className="folio-body mb-4">{opportunity.destination} Your bio and existing features stay unchanged.</p><label className="folio-body mb-4 flex items-start gap-3"><input type="checkbox" disabled={pending || dirty || !snapshot.reviewed} checked={!!snapshot.articleReviewed} onChange={event => setSnapshot({ ...snapshot, articleReviewed: event.target.checked })} />I have reviewed this saved article and want to publish it to my profile.</label>{dirty && <p className="folio-meta mb-3">Save your article edits before reviewing the finished piece.</p>}<button disabled={pending || dirty || !snapshot.reviewed || !snapshot.articleReviewed} className={action} onClick={publish}>{pending ? 'Publishing…' : 'Publish article to my profile'}</button></>}</section>}
      <p className="folio-body text-folio-text-secondary">Your original answers are preserved. Choose an opening answer for the social version, or review the full Q&A.</p>
      {snapshot.definition.brief.subject === 'designer' && <a className="folio-ui inline-block underline underline-offset-4" href="/designer/studio/about-me?activity=bio">Refresh my profile bio</a>}
      { <section aria-label="Folio draft"><h3 className="folio-h4">Folio Q&A</h3><button className={`${secondary} my-3`} onClick={() => copy(`${snapshot.draft!.title}\n\n${snapshot.draft!.entries.map(entry => `${entry.question}\n${entry.answer}`).join('\n\n')}`)}>Copy Q&A</button>{snapshot.publishedUrl || snapshot.publicationNeedsReview ? <div className="space-y-4">{snapshot.draft.entries.map(entry => <div key={entry.questionId}><h4 className="folio-ui">{entry.question}</h4><p className="folio-body mt-1 whitespace-pre-wrap">{entry.answer}</p></div>)}</div> : <div className="space-y-5"><label className="grid gap-2 folio-ui">Article title<input className={field} maxLength={240} disabled={pending} value={snapshot.draft.title} onChange={event => editArticle({ ...snapshot.draft!, title: event.target.value })} /></label>{snapshot.draft.entries.map((entry, i) => <fieldset key={entry.questionId} className="space-y-3"><legend className="folio-meta">Entry {i + 1}</legend><label className="grid gap-2 folio-ui">Question<input className={field} maxLength={2000} disabled={pending} value={entry.question} onChange={event => editArticle({ ...snapshot.draft!, entries: snapshot.draft!.entries.map((value, index) => index === i ? { ...value, question: event.target.value } : value) })} /></label><label className="grid gap-2 folio-ui">Article answer<textarea className={`${field} min-h-32`} maxLength={8000} disabled={pending} value={entry.answer} onChange={event => editArticle({ ...snapshot.draft!, entries: snapshot.draft!.entries.map((value, index) => index === i ? { ...value, answer: event.target.value } : value) })} /></label></fieldset>)}<button className={secondary} disabled={pending || !dirty} onClick={() => save()}>{pending ? 'Saving…' : 'Save article edits'}</button></div>}</section>}
      { <section aria-label="Social draft options"><h3 className="folio-h4">An answer to lead with</h3><p className="folio-meta mt-2">Choose a short answer for a finished Instagram image, or copy an excerpt for your caption.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{snapshot.draft.socialOptions.map(option => <article key={option.questionId} className="rounded-xl border border-folio-border-subtle p-4"><p className="folio-body whitespace-pre-wrap">{option.text}</p><button className="folio-meta mt-3 underline underline-offset-4" onClick={() => copy(option.text)}>Copy excerpt</button><ActivitySocialCard key={`${option.questionId}:${option.text}`} question={snapshot.draft!.entries.find(entry => entry.questionId === option.questionId)!.question} answer={snapshot.draft!.entries.find(entry => entry.questionId === option.questionId)!.answer} designerName={context.designerName} /></article>)}</div>{!snapshot.draft.socialOptions.length && <p className="folio-body mt-3">These answers need a shorter excerpt before a social version can be prepared.</p>}</section>}
      {!snapshot.publishedUrl && !snapshot.publicationNeedsReview && <button className={secondary} onClick={() => setStep('review')}>Review or edit answers</button>}
    </div>}
  </section>;
}
