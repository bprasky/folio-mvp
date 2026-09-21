'use client';

import { useEffect, useState } from 'react';
import type { Candidate } from '@/lib/publishing-studio/readiness/types';

const button = 'folio-ui rounded-full border border-folio-border-subtle px-4 py-2 disabled:opacity-50';
const field = 'w-full rounded-lg border border-folio-border-subtle bg-surface-canvas p-3 folio-body';

export async function updateCandidate(candidate: Candidate, changes: Record<string, unknown>): Promise<Candidate> {
  const response = await fetch(`/api/publishing-studio/readiness/${encodeURIComponent(candidate.id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: candidate.version, sourceVersion: candidate.sourceVersion, ...changes }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'This story could not be saved. Reload if its source changed.');
  return result.candidate;
}

export function CandidateConfigurator({ candidate, onChange, onClose }: {
  candidate: Candidate; onChange: (candidate: Candidate) => void; onClose: () => void;
}) {
  const [headline, setHeadline] = useState(candidate.draft.headline);
  const [caption, setCaption] = useState(candidate.draft.caption);
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const blocker = candidate.blockers.find(item => !item.answer?.trim());
  const hasUnsavedCopy = headline !== candidate.draft.headline || caption !== candidate.draft.caption;
  useEffect(() => { setHeadline(candidate.draft.headline); setCaption(candidate.draft.caption); setAnswer(''); }, [candidate]);
  async function save(changes: Record<string, unknown>) {
    setPending(true); setError('');
    try { onChange(await updateCandidate(candidate, changes)); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save story'); }
    finally { setPending(false); }
  }
  async function download() {
    setPending(true); setError('');
    try {
      const response = await fetch(`/api/publishing-studio/readiness/${encodeURIComponent(candidate.id)}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: candidate.version, sourceVersion: candidate.sourceVersion }),
      });
      const result = await response.json();
      if (!response.ok || !result.images?.length) throw new Error(result.error || 'Could not export this story');
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const image of result.images as { name: string; dataUrl: string }[]) {
        zip.file(image.name, image.dataUrl.substring(image.dataUrl.indexOf(',') + 1), { base64: true });
      }
      zip.file('caption.txt', result.caption);
      const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = result.filename || 'folio-story.zip';
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(url); setDownloaded(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not export this story'); }
    finally { setPending(false); }
  }
  function moveImage(index: number, direction: number) {
    const ids = candidate.visuals.map(image => image.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void save({ action: 'edit', imageIds: ids });
  }
  return <section aria-labelledby="candidate-title" className="space-y-6 rounded-xl border border-folio-border-subtle bg-surface-canvas p-5 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 id="candidate-title" className="folio-h2">{candidate.thesis}</h2><button className={button} onClick={onClose}>Back to stories</button></div>
    <p className="folio-body">{candidate.audienceValue}</p>
    {error && <p role="alert" className="folio-body">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {candidate.visuals.map((image, index) => <figure key={image.id} className="min-w-0 space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={`${image.role}: ${candidate.draft.headline}`} className="aspect-[4/5] w-full rounded-lg object-cover" />
        <figcaption className="folio-meta">{image.role} · {image.reason}</figcaption>
        <div className="flex gap-2"><button className={button} disabled={pending || hasUnsavedCopy || index === 0} onClick={() => moveImage(index, -1)} aria-label={`Move image ${index + 1} earlier`}>Earlier</button><button className={button} disabled={pending || hasUnsavedCopy || index === candidate.visuals.length - 1} onClick={() => moveImage(index, 1)} aria-label={`Move image ${index + 1} later`}>Later</button></div>
      </figure>)}
    </div>
    <div className="space-y-3"><h3 className="folio-h3">Draft</h3>
      <label className="block folio-ui">Headline<input className={field} value={headline} onChange={event => setHeadline(event.target.value)} maxLength={180} /></label>
      <label className="block folio-ui">Caption<textarea className={field} rows={6} value={caption} onChange={event => setCaption(event.target.value)} maxLength={2200} /></label>
      <button className={button} disabled={pending || !headline.trim() || headline.length > 180 || !caption.trim() || caption.length > 2200} onClick={() => save({ action: 'edit', headline, caption })}>Save copy</button>
      {hasUnsavedCopy && <p role="status" className="folio-meta">Save your copy before changing images, answering the next step, or recording publication.</p>}
    </div>
    <div className="space-y-2"><h3 className="folio-h3">Source evidence</h3>{candidate.evidence.map(evidence => <blockquote key={evidence.id} className="border-l border-folio-border-subtle pl-4 folio-body">{evidence.text}<span className="block folio-meta">{evidence.tier === 'direct' ? 'Designer source' : evidence.tier === 'observed' ? 'Observed in source' : 'Needs confirmation'}</span></blockquote>)}</div>
    <div className="space-y-3"><h3 className="folio-h3">Publication checklist</h3>
      <ul className="space-y-2 folio-body">{candidate.blockers.map(item => <li key={item.id}>{item.answer?.trim() ? '✓' : '○'} {item.question}{item.answer && <span className="block folio-meta">{item.answer}</span>}</li>)}</ul>
      {blocker && <form onSubmit={event => { event.preventDefault(); void save({ action: 'answer', blockerId: blocker.id, answer }); }} className="space-y-3 rounded-lg border border-folio-border-subtle p-4">
        <label className="block folio-ui" htmlFor="candidate-answer">{blocker.question}</label>
        {blocker.options && <div className="flex flex-wrap gap-2">{blocker.options.map(option => <button type="button" key={option} className={button} onClick={() => setAnswer(option)}>{option}</button>)}</div>}
        <textarea id="candidate-answer" className={field} rows={3} value={answer} onChange={event => setAnswer(event.target.value)} maxLength={2200} required />
        <button className={button} type="submit" disabled={pending || hasUnsavedCopy || !answer.trim()}>Save and continue</button>
      </form>}
    </div>
    <p className="folio-body">Design: {candidate.draft.credits.designer}. Photography: {candidate.draft.credits.photographer || 'Credit needs confirmation'}.</p>
    <div className="space-y-3 border-t border-folio-border-subtle pt-5">
      <button className={button} disabled={pending || candidate.readiness !== 'ready' || !!blocker || hasUnsavedCopy} onClick={download}>{pending ? 'Saving…' : 'Download post'}</button>
      <p className="folio-meta">The download uses these 4:5 photographs and a separate caption with credits. Downloading does not publish to social media. Save any copy changes before continuing.</p>
      {downloaded && <p role="status" className="folio-body">Your post is ready to share. The download includes its photographs and caption with credits.</p>}
      {candidate.confirmedPublishedAt ? <p className="folio-body">You marked this story as published.</p> : <><label className="flex items-start gap-2 folio-ui"><input type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)} />I have published this story on my social account.</label><button className={button} disabled={pending || hasUnsavedCopy || !published || candidate.readiness !== 'ready'} onClick={() => save({ action: 'published' })}>Record publication</button></>}
    </div>
  </section>;
}
