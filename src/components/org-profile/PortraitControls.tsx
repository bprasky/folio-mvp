'use client';

import { useEffect, useRef, useState } from 'react';
import SafeImage from '@/components/SafeImage';
import type { OrgProfileAppearance } from '@/lib/org-profile-appearance';
import styles from './OrgProfileAppearance.module.css';

type Portrait = NonNullable<OrgProfileAppearance['portrait']>;
type Candidate = { id: string; importId: string; label: string; sourceUrl: string; previewUrl: string };
export default function PortraitControls({ orgId, importId, portrait, onChange, onBusy }: {
  orgId: string; importId?: string; portrait: OrgProfileAppearance['portrait'];
  onChange: (portrait: Portrait | null) => void; onBusy: (busy: boolean) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, Portrait>());
  const endpoint = `/api/orgs/${orgId}/appearance/portraits`;
  useEffect(() => {
    const request = new AbortController();
    setLoading(true); setError(''); setCandidates([]); setIndex(0);
    fetch(endpoint + (importId ? `?import=${importId}` : ''), { cache: 'no-store', signal: request.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!request.signal.aborted) setCandidates(data.candidates); })
      .catch(reason => { if (!request.signal.aborted) setError(reason.message || 'Could not load suggestions.'); })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => { request.abort(); controller.current?.abort(); };
  }, [endpoint, importId, retry]);
  async function post(body: unknown, signal: AbortSignal) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not prepare this photograph.');
    return data;
  }
  async function prepare(original: Portrait, signal: AbortSignal) {
    setMessage('Preparing the portrait cutout…');
    try {
      const data = await post({ originalUrl: original.originalUrl, cutout: true }, signal);
      const updated: Portrait = { ...original, cutoutUrl: data.cutoutUrl, treatment: 'cutout' };
      if (!signal.aborted) { onChange(updated); setMessage('Cutout ready. Save your cover to show it on your profile.'); }
      return updated;
    } catch (reason) {
      if (!signal.aborted) { setError(reason instanceof Error ? reason.message : 'Cutout unavailable. You can use the original.'); setMessage('The original photograph is ready to use.'); }
      return original;
    }
  }
  async function work(action: (signal: AbortSignal) => Promise<void>) {
    controller.current?.abort(); controller.current = new AbortController();
    const signal = controller.current.signal;
    setBusy(true); onBusy(true); setError(''); setMessage('Preparing your photograph…');
    try { await action(signal); }
    catch (reason) { if (!signal.aborted) { setError(reason instanceof Error ? reason.message : 'Could not prepare this photograph.'); setMessage(''); } }
    finally { if (!signal.aborted) { setBusy(false); onBusy(false); } }
  }
  async function choose(candidate: Candidate) {
    if (cache.current.has(candidate.id)) { onChange(cache.current.get(candidate.id)!); setError(''); setMessage('Portrait selected. Save your cover when ready.'); return; }
    await work(async signal => {
      const data = await post({ importId: candidate.importId, candidateId: candidate.id }, signal);
      const original: Portrait = { originalUrl: data.originalUrl, cutoutUrl: null, treatment: 'original', caption: '', position: 50, scale: 100 };
      if (signal.aborted) return;
      onChange(original);
      cache.current.set(candidate.id, await prepare(original, signal));
    });
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPEG, PNG or WebP under 5 MB.'); return; }
    await work(async signal => {
      const body = new FormData(); body.set('file', file);
      const response = await fetch(`/api/orgs/${orgId}/appearance/image`, { method: 'POST', body, signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const original: Portrait = { originalUrl: data.url, cutoutUrl: null, treatment: 'original', caption: '', position: 50, scale: 100 };
      if (signal.aborted) return;
      onChange(original); await prepare(original, signal);
    });
  }
  const candidate = candidates[index];
  return <section aria-label="Founder portrait" className={styles.portraitControls}>
    <h3>The people behind the studio</h3>
    <p>Choose a founder or team photograph to place over your project. Check that the people shown belong to your studio.</p>
    <label>Upload a portrait<input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
    <fieldset disabled={busy}>
      {portrait && <div className="mt-4 space-y-4">
        <div className={styles.inlineControls}>
          <button type="button" className={styles.textButton} aria-pressed={portrait.treatment === 'original'} onClick={() => onChange({ ...portrait, treatment: 'original' })}>Original photo</button>
          <button type="button" className={styles.textButton} aria-pressed={portrait.treatment === 'cutout'} onClick={() => portrait.cutoutUrl ? onChange({ ...portrait, treatment: 'cutout' }) : void work(async signal => { await prepare(portrait, signal); })}>{portrait.cutoutUrl ? 'Cutout' : 'Prepare cutout'}</button>
        </div>
        <label>Portrait position<input type="range" min="0" max="100" value={portrait.position} onChange={event => onChange({ ...portrait, position: Number(event.target.value) })} /></label>
        <label>Portrait size<input type="range" min="70" max="120" value={portrait.scale} onChange={event => onChange({ ...portrait, scale: Number(event.target.value) })} /></label>
        <label>Caption (optional)<input maxLength={160} value={portrait.caption} placeholder="Names and roles" onChange={event => onChange({ ...portrait, caption: event.target.value })} /></label>
        <button type="button" className={styles.textButton} onClick={() => { onChange(null); setMessage('Portrait removed from the preview. Save your cover to apply.'); }}>Remove portrait</button>
      </div>}
    </fieldset>
    {message && <p role="status" aria-live="polite">{message}</p>}
    {loading ? <p role="status">Looking for portrait suggestions…</p> : candidate ? <div>
      <div className={styles.candidatePhoto}><SafeImage key={candidate.id} src={candidate.previewUrl} alt={candidate.label} fill unoptimized sizes="300px" /></div>
      <div className={styles.inlineControls}>
        <button type="button" disabled={busy || candidates.length < 2} className={styles.textButton} aria-label="Previous portrait suggestion" onClick={() => setIndex(value => (value + candidates.length - 1) % candidates.length)}>←</button>
        <span>{index + 1} of {candidates.length}</span>
        <button type="button" disabled={busy || candidates.length < 2} className={styles.textButton} aria-label="Next portrait suggestion" onClick={() => setIndex(value => (value + 1) % candidates.length)}>→</button>
        <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className={styles.textButton}>View source</a>
      </div>
      <button type="button" className={styles.saveButton} disabled={busy} onClick={() => void choose(candidate)}>Use this photograph</button>
    </div> : <p>No portrait suggestions were found.</p>}
    {error && <p role="alert">{error} {!candidate && <button type="button" disabled={busy} className={styles.textButton} onClick={() => setRetry(value => value + 1)}>Reload suggestions</button>}</p>}
  </section>;
}
