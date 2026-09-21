'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Candidate } from '@/lib/publishing-studio/readiness/types';
import { DISMISSAL_REASONS } from '@/lib/publishing-studio/readiness/types';
import { CandidateConfigurator, updateCandidate } from './CandidateConfigurator';

const button = 'folio-ui rounded-full border border-folio-border-subtle px-4 py-2 disabled:opacity-50';
type Data = { candidates: Candidate[]; developing: Candidate[]; workspace?: { name: string } };
async function event(candidate: Candidate, kind: 'shown' | 'opened', eventId: string) {
  const response = await fetch(`/api/publishing-studio/readiness/${encodeURIComponent(candidate.id)}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: candidate.version, sourceVersion: candidate.sourceVersion, kind, eventId }),
  });
  if (!response.ok) throw new Error('Could not record story view');
}

function CandidateCard({ candidate, onOpen, onDismiss }: { candidate: Candidate; onOpen: () => void; onDismiss: (reason: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const tracked = useRef(new Map<string, { id: string; complete: boolean; pending: boolean }>());
  const [reason, setReason] = useState('');
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const key = `${candidate.id}:${candidate.version}:${candidate.sourceVersion}`;
    const state = tracked.current.get(key) || { id: crypto.randomUUID(), complete: false, pending: false };
    tracked.current.set(key, state);
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5) || state.complete || state.pending) return;
      state.pending = true;
      // A retry retains the same identity, so the server can deduplicate delivery.
      void event(candidate, 'shown', state.id).catch(() => event(candidate, 'shown', state.id)).then(() => { state.complete = true; }).catch(() => {}).finally(() => { state.pending = false; });
    }, { threshold: 0.5 });
    observer.observe(node); return () => observer.disconnect();
  }, [candidate]);
  return <article ref={ref} className="min-w-0 space-y-4 rounded-xl border border-folio-border-subtle p-5">
    {candidate.visuals[0] && <img src={candidate.visuals[0].url} alt={candidate.draft.headline} className="aspect-[4/5] w-full rounded-lg object-cover" /> /* eslint-disable-line @next/next/no-img-element */}
    <p className="folio-meta">{candidate.readiness === 'ready' ? 'Ready to publish' : 'Quick Finish'} · {candidate.format === 'carousel' ? 'Carousel' : 'Single image'}</p>
    <h2 className="folio-h3">{candidate.thesis}</h2><p className="folio-body">{candidate.audienceValue}</p>
    <div className="space-y-1"><p className="folio-meta">Prepared caption</p><p className="whitespace-pre-line folio-body">{candidate.draft.caption}</p></div>
    <p className="folio-meta">{candidate.rationale}</p>
    <button className={button} onClick={onOpen}>{candidate.readiness === 'ready' ? 'Review and publish' : 'Finish this story'}</button>
    <details><summary className="cursor-pointer folio-ui">Dismiss suggestion</summary><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Optional dismissal reason" className={button} value={reason} onChange={e => setReason(e.target.value)}><option value="">Reason (optional)</option>{DISMISSAL_REASONS.map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select><button className={button} onClick={() => onDismiss(reason)}>Dismiss</button></div></details>
  </article>;
}

export function ReadinessStudio() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get('project');
  const candidateId = params.get('candidate');
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [dismissed, setDismissed] = useState<Candidate[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const openedQuery = useRef<string | null>(null);
  const primary = data?.candidates.filter(candidate => !projectId || projectId === 'studio-wide' || candidate.projectIds.includes(projectId)) || [];
  const developing = data?.developing.filter(candidate => !projectId || projectId === 'studio-wide' || candidate.projectIds.includes(projectId)) || [];
  useEffect(() => {
    if (!candidateId) { openedQuery.current = null; return; }
    if (openedQuery.current === candidateId || !data) return;
    const match = [...data.candidates, ...data.developing].find(candidate => candidate.id === candidateId);
    if (match && match.readiness !== 'developing') { openedQuery.current = candidateId; setSelected(match); }
  }, [candidateId, data]);
  const reload = useCallback(async () => {
    const response = await fetch('/api/publishing-studio/readiness', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not open Publishing Studio');
    setData(result);
    setDismissed(result.dismissed || []);
  }, []);
  useEffect(() => { void reload().catch(err => setError(err.message)); }, [reload]);
  async function refresh() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/publishing-studio/readiness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not evaluate stories');
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not evaluate stories'); } finally { setPending(false); }
  }
  function change(candidate: Candidate) {
    setSelected(candidate);
    setData(current => current && ({ ...current, candidates: current.candidates.map(item => item.id === candidate.id ? candidate : item) }));
  }
  async function dismiss(candidate: Candidate, reason: string) {
    setError('');
    try { const result = await updateCandidate(candidate, { action: 'dismiss', ...(reason ? { reason } : {}) }); setDismissed(items => [...items.filter(item => item.id !== result.id), result]); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not dismiss story'); }
  }
  async function restore(candidate: Candidate) {
    try { await updateCandidate(candidate, { action: 'restore' }); setDismissed(items => items.filter(item => item.id !== candidate.id)); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not restore story'); }
  }
  return <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="folio-meta">{data?.workspace?.name || 'Your studio'}</p><h1 className="folio-h1">Publishing Studio</h1><p className="folio-body">A few stories worth sharing, grounded in your work.</p></div><button className={button} disabled={pending || !!selected} onClick={refresh}>{pending ? 'Evaluating stories…' : 'Find ready stories'}</button></header>
    <nav className="flex flex-wrap gap-4 folio-ui"><Link href="/designer/studio" className="underline underline-offset-4">All studio stories</Link><Link href="/designer/studio?view=saved" className="underline underline-offset-4">Saved carousels and campaigns</Link></nav>
    {error && <div role="alert" className="space-y-2 folio-body"><p>{error}</p><button className={button} onClick={() => { setError(''); void reload().catch(err => setError(err.message)); }}>Reload</button></div>}
    {selected ? <CandidateConfigurator key={selected.id} candidate={selected} onChange={change} onClose={() => { const next = new URLSearchParams(params.toString()); next.delete('candidate'); router.replace(`/designer/studio${next.size ? `?${next}` : ''}`); setSelected(null); void reload().catch(err => setError(err.message)); }} /> : <>
      {!data && !error && <p className="folio-body">Opening your stories…</p>}
      {data && !primary.length && <div className="space-y-3 rounded-xl border border-folio-border-subtle p-6"><h2 className="folio-h2">No ready stories yet</h2><p className="folio-body">Evaluate your published projects to find supported stories. Some ideas may need more source material before they are ready.</p></div>}
      <div className="grid gap-5 md:grid-cols-2">{primary.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} onOpen={() => { setSelected(candidate); const next = new URLSearchParams(params.toString()); next.set('candidate', candidate.id); router.replace(`/designer/studio?${next}`, { scroll: false }); const id = crypto.randomUUID(); void event(candidate, 'opened', id).catch(() => event(candidate, 'opened', id)).catch(() => {}); }} onDismiss={reason => { void dismiss(candidate, reason); }} />)}</div>
      {!!developing.length && <details className="rounded-xl border border-folio-border-subtle p-5"><summary className="cursor-pointer folio-ui">Developing ideas ({developing.length})</summary><div className="mt-4 space-y-4">{developing.map(candidate => <article key={candidate.id} className="space-y-2"><h2 className="folio-h3">{candidate.thesis}</h2><p className="folio-body">{candidate.reasons.join(' ')}</p>{candidate.projectIds.map(id => <Link key={id} href={`/project/${encodeURIComponent(id)}`} className="folio-ui underline underline-offset-4">Add project context</Link>)}</article>)}</div></details>}
      {!!dismissed.length && <details><summary className="cursor-pointer folio-ui">Recently dismissed</summary>{dismissed.map(candidate => <div key={candidate.id} className="mt-3 flex flex-wrap items-center gap-3"><span className="folio-body">{candidate.thesis}</span><button className={button} onClick={() => restore(candidate)}>Restore</button></div>)}</details>}
    </>}
  </main>;
}
