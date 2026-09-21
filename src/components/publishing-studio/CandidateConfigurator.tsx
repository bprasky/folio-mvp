'use client';

import { useEffect, useRef, useState } from 'react';
import type { Candidate } from '@/lib/publishing-studio/readiness/types';

const button = 'folio-ui inline-flex items-center justify-center rounded-full border border-folio-border-subtle px-4 py-2 text-folio-text-primary transition-colors hover:bg-surface-ground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--folio-gold)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = `${button} border-transparent bg-[var(--folio-gold)] text-white hover:bg-[var(--folio-gold-hover)]`;
const field = 'w-full min-w-0 rounded-lg border border-folio-border-subtle bg-surface-canvas p-3 folio-body text-folio-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--folio-gold)] disabled:opacity-60';
const readinessLabel = (candidate: Candidate) => candidate.readiness === 'ready' ? 'Ready for review' : candidate.readiness === 'quick' ? 'More review needed' : 'Needs more source material';
const recoveryKey = (candidate: Candidate) => `folio:studio-unsaved:${candidate.id}:${candidate.version}:${candidate.sourceVersion}`;

export async function updateCandidate(candidate: Candidate, changes: Record<string, unknown>): Promise<Candidate> {
  const response = await fetch(`/api/publishing-studio/readiness/${encodeURIComponent(candidate.id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: candidate.version, sourceVersion: candidate.sourceVersion, ...changes }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'This story could not be saved. Your changes are still here.');
  return result.candidate;
}

/** Describe only differences in the saved response; never predict answer validity. */
export function savedCandidateSummary(previous: Candidate, saved: Candidate): string {
  const changes = [];
  if (previous.draft.headline !== saved.draft.headline) changes.push('Headline updated.');
  if (previous.draft.caption !== saved.draft.caption) changes.push('Caption updated below.');
  if (previous.draft.credits.photographer !== saved.draft.credits.photographer) changes.push('Photography credit updated.');
  if (previous.visuals.map(image => image.id).join() !== saved.visuals.map(image => image.id).join()) changes.push('Photo order updated.');
  if (previous.blockers.some(blocker => saved.blockers.find(item => item.id === blocker.id)?.answer !== blocker.answer)) changes.push('Answer saved.');
  return `${changes.join(' ') || 'Draft saved.'} ${readinessLabel(saved)}.`;
}

export function CandidateConfigurator({ candidate, onChange, onClose, readOnly = false }: {
  candidate: Candidate; onChange: (candidate: Candidate) => void; onClose: () => void; readOnly?: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    sectionRef.current?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView?.({ block: 'start' });
  }, []);
  const [headline, setHeadline] = useState(candidate.draft.headline);
  const [caption, setCaption] = useState(candidate.draft.caption);
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState<'save' | 'download' | null>(null);
  const [error, setError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [leaveRequested, setLeaveRequested] = useState(false);
  const [published, setPublished] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [missingImages, setMissingImages] = useState<string[]>([]);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  const blockers = candidate.blockers.filter(item => !item.answer?.trim());
  const blocker = blockers[0];
  const hasUnsavedCopy = headline !== candidate.draft.headline || caption !== candidate.draft.caption;
  const hasUnsavedAnswer = !!answer.trim();
  const hasUnsavedChanges = !readOnly && (hasUnsavedCopy || hasUnsavedAnswer);
  const locked = !!pending || readOnly;
  const storageKey = recoveryKey(candidate);
  const savedHeadline = candidate.draft.headline, savedCaption = candidate.draft.caption, blockerId = blocker?.id;

  // Session-only recovery is an unsaved editing buffer, never a persisted draft
  // or a readiness decision. Exact source/version keys prevent stale replay.
  useEffect(() => {
    let restored = false;
    let copyHeadline = savedHeadline, copyCaption = savedCaption, copyAnswer = '';
    if (!readOnly) {
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (raw) {
          const value = JSON.parse(raw);
          if (typeof value.headline === 'string' && value.headline.length <= 180 && typeof value.caption === 'string' && value.caption.length <= 2200 && typeof value.answer === 'string' && value.answer.length <= 2200) {
            copyHeadline = value.headline; copyCaption = value.caption;
            copyAnswer = value.blockerId === blockerId ? value.answer : '';
            restored = copyHeadline !== savedHeadline || copyCaption !== savedCaption || !!copyAnswer.trim();
          }
        }
      } catch { setRecoveryUnavailable(true); }
    }
    setHeadline(copyHeadline); setCaption(copyCaption); setAnswer(copyAnswer);
    setRecovered(restored); setHydratedKey(storageKey);
  }, [storageKey, readOnly, savedHeadline, savedCaption, blockerId]);
  useEffect(() => {
    if (readOnly || hydratedKey !== storageKey) return;
    try {
      if (hasUnsavedChanges) window.sessionStorage.setItem(storageKey, JSON.stringify({ headline, caption, answer, blockerId }));
      else window.sessionStorage.removeItem(storageKey);
    } catch { setRecoveryUnavailable(true); }
  }, [headline, caption, answer, blockerId, hydratedKey, storageKey, hasUnsavedChanges, readOnly]);
  useEffect(() => {
    if (!hasUnsavedChanges && !pending) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [hasUnsavedChanges, pending]);

  async function save(changes: Record<string, unknown>) {
    if (locked) return;
    setPending('save'); setError(''); setSaveNotice('');
    try {
      const saved = await updateCandidate(candidate, changes);
      const remainingAnswer = changes.action === 'answer' ? '' : answer;
      try {
        if (remainingAnswer.trim()) window.sessionStorage.setItem(recoveryKey(saved), JSON.stringify({ headline: saved.draft.headline, caption: saved.draft.caption, answer: remainingAnswer, blockerId }));
        window.sessionStorage.removeItem(storageKey);
      } catch { setRecoveryUnavailable(true); }
      setSaveNotice(savedCandidateSummary(candidate, saved));
      setHeadline(saved.draft.headline); setCaption(saved.draft.caption);
      if (changes.action === 'answer') setAnswer('');
      setDownloaded(false); setPublished(false);
      onChange(saved);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this story. Your changes are still here.'); }
    finally { setPending(null); }
  }
  async function download() {
    if (locked || hasUnsavedChanges || blockers.length || candidate.readiness !== 'ready') return;
    setPending('download'); setError('');
    try {
      const response = await fetch(`/api/publishing-studio/readiness/${encodeURIComponent(candidate.id)}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: candidate.version, sourceVersion: candidate.sourceVersion }),
      });
      const result = await response.json();
      if (!response.ok || !result.images?.length) throw new Error(result.error || 'Could not export this story');
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const image of result.images as { name: string; dataUrl: string }[]) zip.file(image.name, image.dataUrl.substring(image.dataUrl.indexOf(',') + 1), { base64: true });
      zip.file('caption.txt', result.caption);
      const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = result.filename || 'folio-story.zip';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url); setDownloaded(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not export this story'); }
    finally { setPending(null); }
  }
  function moveImage(index: number, direction: number) {
    const ids = candidate.visuals.map(image => image.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void save({ action: 'edit', imageIds: ids });
  }
  function requestClose() {
    if (pending) return;
    if (hasUnsavedChanges) setLeaveRequested(true); else onClose();
  }

  return <section ref={sectionRef} tabIndex={-1} aria-labelledby="candidate-title" className="space-y-6 text-folio-text-primary focus:outline-none">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-folio-border-subtle pb-4">
      <button className={button} disabled={!!pending} onClick={requestClose}>Back to stories</button>
      <p aria-live="polite" className="folio-meta text-folio-text-secondary">{readOnly ? 'Saved version · read only' : pending === 'save' ? 'Saving draft…' : pending === 'download' ? 'Preparing download…' : hasUnsavedChanges ? 'Unsaved changes' : 'Saved draft'}</p>
    </div>
    {recovered && hasUnsavedChanges && <p role="status" className="folio-meta text-folio-text-secondary">Recovered unsaved changes from this browser session. Save them to update your draft.</p>}
    {recoveryUnavailable && hasUnsavedChanges && <p role="status" className="folio-meta text-folio-text-secondary">This browser could not retain unsaved changes. Save before leaving this story.</p>}
    {leaveRequested && <div role="alert" className="space-y-3 border-l-2 border-[var(--folio-gold)] bg-surface-ground p-4">
      <p className="folio-body">Your latest {hasUnsavedCopy && hasUnsavedAnswer ? 'copy and answer are' : hasUnsavedCopy ? 'copy is' : 'answer is'} not saved. Keep editing to save before returning.</p>
      <div className="flex flex-wrap gap-2"><button className={primaryButton} onClick={() => setLeaveRequested(false)}>Keep editing</button><button className={button} onClick={() => { try { window.sessionStorage.removeItem(storageKey); } catch { /* Closing does not depend on browser storage. */ } onClose(); }}>Discard unsaved changes</button></div>
    </div>}
    <header className="max-w-3xl space-y-2"><p className="folio-meta text-folio-text-secondary">{candidate.source?.title || 'Your project'} · {candidate.format === 'carousel' ? 'Carousel' : 'Single photograph'}</p><h2 id="candidate-title" className="folio-h2">{candidate.thesis}</h2><p className="folio-body text-folio-text-secondary">{candidate.audienceValue}</p></header>
    {error && <p role="alert" className="border-l-2 border-[var(--folio-gold)] bg-surface-ground p-4 folio-body">{error}</p>}
    {saveNotice && <p role="status" className="border-l border-folio-border-subtle pl-4 folio-body">{saveNotice}</p>}
    <div className="grid items-start gap-8 lg:grid-cols-5">
      <div className="min-w-0 space-y-6 lg:col-span-3">
        <div className={`grid gap-4 ${candidate.visuals.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {candidate.visuals.map((image, index) => <figure key={image.id} className="min-w-0 space-y-2">
            {missingImages.includes(image.id) ? <div role="status" className="flex aspect-[4/5] items-center justify-center bg-surface-ground p-5 folio-body">This selected photograph is unavailable. Review its project source before downloading.</div> : <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={`${image.role}: ${candidate.draft.headline}`} onError={() => setMissingImages(ids => [...ids, image.id])} className="aspect-[4/5] w-full rounded-sm object-cover" />
            </>}
            <figcaption className="folio-meta text-folio-text-secondary">{index === 0 ? 'Cover' : `Photo ${index + 1}`} · {image.reason}</figcaption>
            {!readOnly && candidate.visuals.length > 1 && <div className="flex gap-2"><button className={button} disabled={locked || hasUnsavedChanges || index === 0} onClick={() => moveImage(index, -1)} aria-label={`Move image ${index + 1} earlier`}>Earlier</button><button className={button} disabled={locked || hasUnsavedChanges || index === candidate.visuals.length - 1} onClick={() => moveImage(index, 1)} aria-label={`Move image ${index + 1} later`}>Later</button></div>}
          </figure>)}
          {!candidate.visuals.length && <p className="bg-surface-ground p-5 folio-body">No selected photograph is available for this draft.</p>}
        </div>
        <div className="space-y-4 border-t border-folio-border-subtle pt-5"><h3 className="folio-h3">Your post</h3>
          <label className="block space-y-2 folio-ui">Headline<input className={field} value={headline} disabled={!!pending} readOnly={readOnly} onChange={event => setHeadline(event.target.value)} maxLength={180} /></label>
          <label className="block space-y-2 folio-ui">Caption<textarea className={field} rows={7} value={caption} disabled={!!pending} readOnly={readOnly} onChange={event => setCaption(event.target.value)} maxLength={2200} /></label>
          {!readOnly && <div className="flex flex-wrap items-center gap-3"><button className={button} disabled={locked || !headline.trim() || headline.length > 180 || !caption.trim() || caption.length > 2200} onClick={() => save({ action: 'edit', headline, caption })}>Save draft</button>{hasUnsavedCopy && <p className="folio-meta text-folio-text-secondary">Save copy before completing another step.</p>}</div>}
          <p className="folio-meta text-folio-text-secondary">Design: {candidate.draft.credits.designer}<br />Photography: {candidate.draft.credits.photographer || 'Credit needs confirmation'}</p>
        </div>
      </div>
      <aside aria-label="Story review" className="order-first min-w-0 space-y-6 lg:order-none lg:col-span-2">
        {!readOnly && blocker ? <form onSubmit={event => { event.preventDefault(); if (!hasUnsavedCopy) void save({ action: 'answer', blockerId: blocker.id, answer }); }} className="space-y-4 border-t-2 border-[var(--folio-gold)] bg-surface-ground p-5">
          <div className="space-y-2"><p className="folio-meta text-folio-text-secondary">{blockers.length === 1 ? 'One step to review' : `${blockers.length} steps to review`}</p><h3 className="folio-h3">{blocker.kind === 'credit' ? 'Complete the credit' : blocker.kind === 'visual' ? 'Review the imagery' : 'A detail only you can add'}</h3><p id="candidate-question" className="folio-body">{blocker.question}</p></div>
          {blocker.options && <div className="flex flex-wrap gap-2">{blocker.options.map(option => <button type="button" key={option} disabled={locked} aria-pressed={answer === option} className={answer === option ? primaryButton : button} onClick={() => setAnswer(option)}>{candidate.visuals.find(image => image.id === option) ? `Photo ${candidate.visuals.findIndex(image => image.id === option) + 1}` : option}</button>)}</div>}
          {!blocker.options && <textarea id="candidate-answer" aria-labelledby="candidate-question" className={field} rows={4} disabled={locked} value={answer} onChange={event => setAnswer(event.target.value)} maxLength={2200} required />}
          <button className={primaryButton} type="submit" disabled={locked || hasUnsavedCopy || !answer.trim()}>Save and continue</button>
          <p className="folio-meta text-folio-text-secondary">Your saved answer updates this story. Review the returned draft before sharing.</p>
        </form> : <div className="space-y-3 border-t border-folio-border-subtle pt-4"><h3 className="folio-h3">{readOnly ? 'Saved story' : readinessLabel(candidate)}</h3><p className="folio-body text-folio-text-secondary">{readOnly ? 'This saved version remains available to read. Continue from a current editable draft to make changes or prepare another download.' : candidate.readiness === 'ready' ? 'Review the photographs, wording, and credits before downloading your post.' : 'The story needs more source material before it can be shared.'}</p>{!readOnly && candidate.readiness !== 'ready' && candidate.reasons.map(reason => <p key={reason} className="folio-meta text-folio-text-secondary">{reason}</p>)}</div>}
        {!!candidate.evidence.length && <details className="border-t border-folio-border-subtle pt-4"><summary className="cursor-pointer folio-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--folio-gold)]">From your project</summary><div className="mt-4 space-y-4">{candidate.evidence.map(evidence => <blockquote key={evidence.id} className="space-y-1 border-l border-folio-border-subtle pl-3 folio-body">{evidence.text}<span className="block folio-meta text-folio-text-secondary">{evidence.tier === 'direct' ? 'Designer source' : evidence.tier === 'observed' ? 'Observed in source' : 'Needs confirmation'}</span></blockquote>)}</div></details>}
        {!!candidate.blockers.some(item => item.answer?.trim()) && <details className="border-t border-folio-border-subtle pt-4"><summary className="cursor-pointer folio-ui">Saved answers</summary><dl className="mt-4 space-y-4">{candidate.blockers.filter(item => item.answer?.trim()).map(item => <div key={item.id}><dt className="folio-ui">{item.question}</dt><dd className="mt-1 folio-body text-folio-text-secondary">{item.answer}</dd></div>)}</dl></details>}
        {!readOnly && <div className="space-y-3 border-t border-folio-border-subtle pt-5">
          <button className={primaryButton} disabled={locked || candidate.readiness !== 'ready' || !!blocker || hasUnsavedChanges || !candidate.visuals.length || !!missingImages.length} onClick={download}>Download post</button>
          <p className="folio-meta text-folio-text-secondary">Includes the selected 4:5 photographs and a separate caption with credits. Downloading does not publish to social media.</p>
          {downloaded && <p role="status" className="folio-body">Download prepared. Your story is still saved here.</p>}
          {candidate.confirmedPublishedAt ? <p className="folio-body">You marked this story as published.</p> : <details className="pt-2"><summary className="cursor-pointer folio-ui">Already shared this post?</summary><div className="mt-3 space-y-3"><label className="flex items-start gap-2 folio-ui"><input type="checkbox" checked={published} disabled={locked} onChange={event => setPublished(event.target.checked)} />I have published this story on my social account.</label><button className={button} disabled={locked || hasUnsavedChanges || !published || candidate.readiness !== 'ready'} onClick={() => save({ action: 'published' })}>Record publication</button></div></details>}
        </div>}
      </aside>
    </div>
  </section>;
}
