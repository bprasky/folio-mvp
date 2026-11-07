'use client';
import { useEffect, useRef, useState } from 'react';
import { scheduleCanRun, scheduleReview } from '@/lib/import-agent/finishScheduleReview';

export type ScheduleTag = {
  id: string; description: string; category: string | null; roomType: string | null;
  extractedVendor: string | null; extractedPrice: number | null; extractedSku: string | null;
  extractedDimensions: string | null; extractedMaterial: string | null; extractedProductUrl: string | null;
  topSuggestion?: unknown;
  useResearch?: boolean;
};
type Photo = { id: string; url: string };
export function FinishScheduleReview({ tags, photos, onRefresh, onPlace, onDismiss, onConfirm }: {
  tags: ScheduleTag[]; photos: Photo[]; onRefresh: () => Promise<void>;
  onPlace: (tag: ScheduleTag) => void; onDismiss: (id: string) => Promise<void>;
  onConfirm: (tag: ScheduleTag, useResearch: boolean) => Promise<void>;
}) {
  const latest = useRef(tags); latest.current = tags;
  const busy = useRef(new Set<string>());
  const halted = useRef(false);
  const [working, setWorking] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [omitResearch, setOmitResearch] = useState<Record<string, boolean>>({});
  const run = async (id: string, retry = false) => {
    if (busy.current.has(id) || busy.current.size >= 3) return;
    busy.current.add(id); setWorking(Array.from(busy.current)); setError('');
    try {
      const response = await fetch(`/api/import/pending-tag/${id}/research`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retry }) });
      if (!response.ok) throw new Error('Processing stopped. Your items are saved; select Resume to try again.');
      await onRefresh();
    } catch (e) { halted.current = true; setError(e instanceof Error ? e.message : 'Processing stopped.'); }
    finally { busy.current.delete(id); setWorking(Array.from(busy.current)); }
  };
  const runRef = useRef(run); runRef.current = run;
  const refreshRef = useRef(onRefresh); refreshRef.current = onRefresh;
  const lastPoll = useRef(0);
  useEffect(() => {
    const tick = () => {
      if (busy.current.size >= 3 || halted.current) return;
      const next = latest.current.filter(t => { const r = scheduleReview(t.topSuggestion); return !busy.current.has(t.id) && r && scheduleCanRun(r); }).slice(0, 3 - busy.current.size);
      if (next.length) next.forEach(t => { void runRef.current(t.id); });
      else if (latest.current.some(t => scheduleReview(t.topSuggestion)?.state === 'processing') && Date.now() - lastPoll.current > 5000) {
        lastPoll.current = Date.now();
        void refreshRef.current().catch(() => { halted.current = true; setError('Could not refresh progress. Select Resume to try again.'); });
      }
    };
    tick(); const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, []);
  const confirm = async (tag: ScheduleTag) => {
    if (saving) return;
    setSaving(tag.id);
    try { await onConfirm(tag, !omitResearch[tag.id]); } finally { setSaving(null); }
  };
  const remaining = tags.filter(t => ['queued', 'processing'].includes(scheduleReview(t.topSuggestion)?.state || '')).length;
  return <section className="rounded-2xl border border-folio-border-subtle p-4 space-y-4" aria-label="Finish schedule review">
    <div><h3 className="font-semibold">From your finish schedule · {tags.length} to review</h3>
      <p className="text-sm text-folio-text-secondary">Review suggested pins and product details, then confirm. You can also place any item yourself.</p>
      {remaining > 0 && <p role="status" className="text-sm mt-2">Matching photos and researching products · {remaining} remaining. You can leave and return to resume.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error} <button className="underline" onClick={() => { halted.current = false; setError(''); }}>Resume</button></p>}
    </div>
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">{tags.map(tag => {
      const review = scheduleReview(tag.topSuggestion);
      const research = review?.research;
      const usable = research?.exact && research.confidence !== 'low';
      const matches = review?.matches.filter(m => photos.some(p => p.id === m.imageId)) || [];
      const processing = working.includes(tag.id) || review?.state === 'processing';
      return <li key={tag.id} className="rounded-xl border border-folio-border-subtle p-3 space-y-3 min-w-0">
        <div><h4 className="font-medium">{tag.description}</h4><p className="text-sm text-folio-text-secondary">{[tag.roomType, tag.extractedVendor, tag.extractedMaterial].filter(Boolean).join(' · ')}</p></div>
        {processing && <p role="status" className="text-sm">Finding photo locations and researching details…</p>}
        {matches.map(match => <figure key={match.imageId} className="space-y-1">
          <div className="relative">
            {/* Native image keeps the overlay tied to actual image bounds (no object-fit crop). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos.find(p => p.id === match.imageId)!.url} alt={`Suggested location for ${tag.description}`} className="w-full h-auto rounded-lg" />
            <span aria-label="Suggested pin" className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-6 h-6 bg-white border-2 border-amber-600 text-center text-amber-800 shadow" style={{ left: `${match.x * 100}%`, top: `${match.y * 100}%` }}>•</span>
          </div><figcaption className="text-xs text-folio-text-secondary">{match.confidence} confidence · {match.reason}</figcaption>
        </figure>)}
        {research && <div className="text-sm space-y-1">
          <a className="underline break-words" href={research.productUrl} target="_blank" rel="noopener noreferrer">{usable ? 'Product source' : 'Similar / uncertain result'}: {research.productName}</a>
          {usable && <>
            {research.imageUrl && <img src={research.imageUrl} alt="Product reference from source" className="h-24 w-24 object-contain rounded border" />}
            {!research.imageUrl && <p className="text-xs">Product reference image not found; add one in the product editor.</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt>Price</dt><dd>{tag.extractedPrice != null ? `$${tag.extractedPrice / 100} (schedule)` : research.priceCents != null ? `$${research.priceCents / 100} (source)` : 'Not found'}</dd>
              <dt>Dimensions</dt><dd>{tag.extractedDimensions || research.dimensions || 'Not found'}</dd>
              <dt>SKU</dt><dd>{tag.extractedSku || research.sku || 'Not found'}</dd>
              <dt>Material</dt><dd>{tag.extractedMaterial || research.material || 'Not found'}</dd>
              <dt>Vendor finish</dt><dd>{research.finish || 'Not found'}</dd>
            </dl>
            {research.description && <p>{research.description}</p>}
            <label className="flex gap-2 items-start"><input type="checkbox" checked={!omitResearch[tag.id]} onChange={e => setOmitResearch(v => ({ ...v, [tag.id]: !e.target.checked }))} />Use researched fields where the schedule is blank</label>
          </>}
        </div>}
        {review?.warnings.map(w => <p key={w} className="text-sm text-amber-800">{w}</p>)}
        <div className="flex flex-wrap gap-3 text-sm">
          {!!matches.length && <button disabled={!!saving || processing} className="rounded-lg bg-neutral-900 text-white px-3 py-2 disabled:opacity-50" onClick={() => confirm(tag)}>{saving === tag.id ? 'Saving…' : `Confirm ${matches.length === 1 ? 'suggested tag' : `${matches.length} suggested tags`}`}</button>}
          <button className="underline" disabled={processing} onClick={() => onPlace({ ...tag, useResearch: !omitResearch[tag.id] })}>Place manually</button>
          {review && ['failed', 'done'].includes(review.state) && <button className="underline" disabled={working.length >= 3} onClick={() => run(tag.id, true)}>Retry search</button>}
          <button className="text-folio-text-secondary underline" disabled={processing || !!saving} onClick={() => onDismiss(tag.id)}>Dismiss</button>
        </div>
      </li>;
    })}</ul>
  </section>;
}
