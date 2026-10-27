'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from '@/components/FolioImage';
import type { AlignedSegment, Scene } from '@/lib/interview-media/types';

type Item = {
  id: string; sessionId: string; kind: 'capture' | 'plan'; state: string; version: number; title?: string;
  mimeType?: string; durationMs?: number; offsetMs?: number; hasVideo?: boolean; transcript?: AlignedSegment[];
  moments?: { startMs: number; endMs: number; quoteText: string }[]; images?: { id: string; url: string; credit?: string }[];
  speakerId?: string; sourceKey?: string; error?: string; approved?: boolean; published?: boolean; hasOutput?: boolean; format?: string;
  description?: string; credits?: string; aspect?: 'portrait' | 'landscape'; scenes?: Scene[];
};
async function api(path: string, body?: unknown, method = 'POST') {
  const response = await fetch(path, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Media could not be loaded.');
  return value;
}
export function InterviewMediaLibrary() {
  const [items, setItems] = useState<Item[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]), [title, setTitle] = useState(''), [description, setDescription] = useState('');
  const [credits, setCredits] = useState(''), [format, setFormat] = useState<'short' | 'episode' | 'audio'>('short'), [aspect, setAspect] = useState<'portrait' | 'landscape'>('portrait');
  const [playback, setPlayback] = useState<{ url: string; mimeType: string; id: string } | null>(null);
  const load = useCallback(async () => { try { setItems((await api('/api/interview-media')).items); } catch (e) { setError((e as Error).message); } }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 10000); return () => clearInterval(timer); }, [load]);
  async function work(action: () => Promise<void>) { setError(''); setBusy(true); try { await action(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const captures = items.filter(i => i.kind === 'capture'), plans = items.filter(i => i.kind === 'plan');
  const first = captures.find(c => c.id === scenes[0]?.captureId);
  function add(run: Item, startMs: number, endMs: number) {
    if (first && first.sourceKey !== run.sourceKey) { setError('Build each piece from one interview source. Its authorized source can include multiple projects.'); return; }
    const spans = run.transcript!.filter(s => s.startMs >= startMs && s.endMs <= endMs);
    setScenes(old => [...old, { captureId: run.id, captureVersion: run.version, startMs, endMs,
      speakerId: run.speakerId!, imageId: run.hasVideo ? undefined : run.images?.[0]?.id, focalX: 0.5, focalY: 0.5, transition: 'cut', captionOrders: spans.map(s => s.order), chapter: '' }]);
  }
  function patchScene(index: number, update: Partial<Scene>) { setScenes(old => old.map((s, i) => i === index ? { ...s, ...update } : s)); }
  async function play(id: string) { setPlayback({ ...await api(`/api/interview-media/${id}/playback`), id }); }
  return <div className="space-y-8">
    <div><Link href="/designer/studio" className="folio-meta">← Publishing Studio</Link><h1 className="mt-4 folio-h1">Interview media</h1>
      <p className="mt-2 folio-body">Listen to your saved voice, select exact spoken moments, and review a real rendered piece before approving it.</p></div>
    {error && <p role="alert" className="rounded border border-red-300 p-3 text-sm">{error}</p>}
    {playback && <div className="rounded border p-4"><p className="mb-2 folio-meta">Private review</p>
      {playback.mimeType.startsWith('video/') ? <video key={playback.url} src={playback.url} controls playsInline className="max-h-[60vh] w-full bg-black" /> : <audio key={playback.url} src={playback.url} controls className="w-full" />}
      <button onClick={() => setPlayback(null)} className="mt-2 text-sm underline">Close playback</button></div>}
    <section aria-label="Recordings" className="space-y-4"><h2 className="folio-h2">Saved recordings</h2>
      {!captures.length && <p className="folio-body">Choose “Save my voice” or “Save my voice and camera” when starting a live interview. Text-only interviews have no recorded audio.</p>}
      {captures.map(run => <article key={run.id} className="rounded border p-4 space-y-3"><p className="folio-meta">{run.hasVideo ? 'Voice and camera' : 'Voice'} · {run.state} · {Math.round((run.durationMs || 0) / 1000)} seconds · starts at {Math.round((run.offsetMs || 0) / 1000)} seconds</p>
        {run.error && <p role="status" className="text-sm">{run.error}</p>}
        {run.state === 'failed' && <button disabled={busy} className="text-sm underline" onClick={() => void work(async () => { await api('/api/interview-media/capture', { action: 'retry', runId: run.id }); })}>Retry recording processing</button>}
        {run.state === 'ready' && <><button disabled={busy} onClick={() => void work(() => play(run.id))} className="underline text-sm">Listen in context</button>
          <div className="space-y-2">{run.moments?.map((moment, index) => <div key={index} className="border-l-2 pl-3"><p className="folio-body">“{moment.quoteText}”</p>
            <button disabled={busy} className="text-sm underline" onClick={() => add(run, moment.startMs, moment.endMs)}>Add moment ({Math.round((moment.endMs - moment.startMs) / 1000)}s)</button></div>)}</div>
          <details><summary className="cursor-pointer text-sm">Recording-aligned transcript</summary><p className="text-xs my-2">Timing is aligned to the recorded audio at phrase level. Editorial text corrections do not replace these spoken words.</p>
            {run.transcript?.map(s => <p key={s.order} className="my-2 text-sm"><button className="underline mr-2" onClick={() => add(run, s.startMs, s.endMs)}>{(s.startMs / 1000).toFixed(1)}–{(s.endMs / 1000).toFixed(1)}s</button>{s.text}</p>)}</details></>}
      </article>)}
    </section>
    {scenes.length > 0 && <section aria-label="Edit media piece" className="rounded border p-5 space-y-4"><h2 className="folio-h2">Your selected moments</h2>
      <label className="block text-sm">Title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} className="block w-full rounded border p-2" /></label>
      <label className="block text-sm">Description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block text-sm">Credits<input value={credits} onChange={e => setCredits(e.target.value)} maxLength={1000} className="block w-full rounded border p-2" /></label>
      <div className="flex flex-wrap gap-4"><label className="text-sm">Format<select value={format} onChange={e => setFormat(e.target.value as typeof format)} className="ml-2 border p-2"><option value="short">Short clip</option><option value="episode">Episode video</option><option value="audio">Audio piece</option></select></label>
        {format !== 'audio' && <label className="text-sm">Composition<select value={aspect} onChange={e => setAspect(e.target.value as typeof aspect)} className="ml-2 border p-2"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>}</div>
      {scenes.map((scene, index) => { const run = captures.find(c => c.id === scene.captureId); if (!run) return <p key={index}>This recording is no longer available.</p>; return <div key={`${scene.captureId}-${index}`} className="rounded border p-3 space-y-2">
        <div className="flex gap-3"><span className="text-sm">Segment {index + 1}</span><button className="text-sm underline" disabled={index === 0} onClick={() => setScenes(old => { const copy = [...old]; [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]; return copy; })}>Move earlier</button>
          <button className="text-sm underline" onClick={() => setScenes(old => old.filter((_, i) => i !== index))}>Remove</button></div>
        <label className="block text-sm">Chapter<input value={scene.chapter} onChange={e => patchScene(index, { chapter: e.target.value })} maxLength={120} className="ml-2 border p-1" /></label>
        <div className="flex flex-wrap gap-3">{(['startMs', 'endMs'] as const).map(edge => <label key={edge} className="text-sm">{edge === 'startMs' ? 'Start' : 'End'}<select className="ml-2 border p-1" value={scene[edge]} onChange={e => { const bounds = { ...scene, [edge]: Number(e.target.value) }; patchScene(index, { [edge]: Number(e.target.value), captionOrders: run.transcript!.filter(s => s.startMs >= bounds.startMs && s.endMs <= bounds.endMs).map(s => s.order) }); }}>
          {run.transcript?.map(s => <option key={s.order} value={s[edge]}>{(s[edge] / 1000).toFixed(1)}s · {s.text.slice(0, 35)}</option>)}</select></label>)}</div>
        {format !== 'audio' && <><label className="block text-sm">Picture<select value={scene.imageId || ''} onChange={e => patchScene(index, { imageId: e.target.value || undefined })} className="ml-2 border p-1">{run.hasVideo && <option value="">My recorded camera</option>}{run.images?.map(image => <option key={image.id} value={image.id}>{image.credit ? `Photo · ${image.credit}` : image.id}</option>)}</select></label>
          {scene.imageId && run.images?.find(image => image.id === scene.imageId)?.url && <><Image unoptimized width={160} height={112} alt="Selected authorized photograph" src={run.images.find(image => image.id === scene.imageId)!.url} className="h-28 w-40 object-cover" /><label className="block text-sm">Horizontal crop focus<input type="range" min={0} max={1} step={0.05} value={scene.focalX} onChange={e => patchScene(index, { focalX: Number(e.target.value) })} /></label><label className="block text-sm">Vertical crop focus<input type="range" min={0} max={1} step={0.05} value={scene.focalY} onChange={e => patchScene(index, { focalY: Number(e.target.value) })} /></label></>}</>}
      </div>; })}
      <p className="text-sm">Recording consent does not publish this piece. Every new edit is rendered and approved separately.</p>
      <button disabled={busy || !title.trim() || !first} onClick={() => void work(async () => { await api('/api/interview-media', { sessionId: first!.sessionId, title, description, credits, format, aspect, scenes }); setScenes([]); })} className="rounded border px-4 py-2">Render private preview</button>
    </section>}
    <section aria-label="Media pieces" className="space-y-4"><h2 className="folio-h2">Media pieces</h2>{plans.map(plan => <article key={plan.id} className="rounded border p-4 space-y-3"><h3 className="folio-h3">{plan.title}</h3><p className="folio-meta">{plan.format} · {plan.state}{plan.approved ? ' · Approved' : ''}</p>
      {plan.error && <p className="text-sm">{plan.error}</p>}<div className="flex flex-wrap gap-4">
        <button disabled={busy} className="underline text-sm" onClick={() => { setScenes(plan.scenes || []); setTitle(plan.title || ''); setDescription(plan.description || ''); setCredits(plan.credits || ''); setFormat(plan.format as typeof format); setAspect(plan.aspect || 'portrait'); }}>Edit selection as a new version</button>
        {plan.hasOutput && <button disabled={busy} className="underline text-sm" onClick={() => void work(() => play(plan.id))}>Preview actual piece</button>}
        {plan.hasOutput && !plan.approved && <button disabled={busy || playback?.id !== plan.id} className="underline text-sm" onClick={() => void work(async () => { await api('/api/interview-media', { id: plan.id, action: 'approve', expectedVersion: plan.version }, 'PATCH'); })}>Approve this version</button>}
        {plan.approved && !plan.published && <button disabled={busy} className="underline text-sm" onClick={() => void work(async () => { await api('/api/interview-media', { id: plan.id, action: 'publish', expectedVersion: plan.version }, 'PATCH'); })}>Publish to Folio</button>}
        {plan.published && <><Link className="underline text-sm" href={`/interview-media/${plan.id}`}>View on Folio</Link><button disabled={busy} className="underline text-sm" onClick={() => void work(async () => { const value = await api(`/api/interview-media/${plan.id}/playback?purpose=export`); window.location.assign(value.url); })}>Export approved file</button><button disabled={busy} className="underline text-sm" onClick={() => void work(async () => { await api('/api/interview-media', { id: plan.id, action: 'withdraw', expectedVersion: plan.version }, 'PATCH'); })}>Withdraw</button></>}
        {plan.state === 'failed' && <button disabled={busy} className="underline text-sm" onClick={() => void work(async () => { await api('/api/interview-media', { id: plan.id, action: 'retry', expectedVersion: plan.version }, 'PATCH'); })}>Retry rendering</button>}
        {plan.state === 'queued' && <button disabled={busy} className="underline text-sm" onClick={() => void work(async () => { await api('/api/interview-media', { id: plan.id, action: 'cancel', expectedVersion: plan.version }, 'PATCH'); })}>Cancel render</button>}
      </div></article>)}</section>
    <p className="text-xs">Private previews carry a draft marker. Publishing and export recheck the current Folio source and your exact approval. Withdrawing prevents new access; files already downloaded cannot be recalled.</p>
  </div>;
}
