'use client';

import { CarouselHero } from '@/components/instagram-export/CarouselHero';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActivityExit } from './UnsavedActivityDialog';

import type { ReleasePlanItem as PlanItem, ReleaseOption as Post, ReleasePlanResponse as Release } from '@/lib/publishing-studio/release-plan';

export function StudioReleasePlan() {
  const params = useSearchParams();
  const projectId = params.get('projectId') || '';
  const [release, setRelease] = useState<Release | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [baseline, setBaseline] = useState('[]');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dirty = JSON.stringify(items) !== baseline;
  useEffect(() => {
    let cancelled = false;
    setRelease(null); setError(''); setSaved(false); setStep(0);
    if (!projectId) { setError('Choose a project release from the Studio.'); return; }
    fetch(`/api/publishing-studio/releases?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' }).then(async response => {
      const data: Release & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open your release plan.');
      if (cancelled) return;
      const introduction = data.options.find(post => post.kind === 'introduction');
      const initial = data.plan?.items ?? (introduction ? [{ sourceId: introduction.sourceId, revision: introduction.revision, planningDate: null }] : []);
      setRelease(data); setItems(initial); setBaseline(JSON.stringify(initial)); setSaved(Boolean(data.plan));
      if (data.plan) setStep(2);
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open your release plan.'); });
    return () => { cancelled = true; };
  }, [projectId, attempt]);

  async function save() {
    if (!release || pending) return false;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/publishing-studio/releases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, expectedVersion: release.plan?.version ?? 0, items }) });
      const data: Release & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your release plan could not be saved. Your selections are still here.');
      setRelease(data); setItems(data.plan!.items); setBaseline(JSON.stringify(data.plan!.items)); setSaved(true);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your release plan.'); return false; }
    finally { setPending(false); }
  }
  const exit = useActivityExit(dirty, pending, save);
  function select(post: Post, checked: boolean) {
    setSaved(false);
    setItems(current => checked ? [...current, { sourceId: post.sourceId, revision: post.revision, planningDate: null }] : current.filter(item => item.sourceId !== post.sourceId));
  }
  function move(index: number, offset: number) {
    setSaved(false);
    setItems(current => { const next = [...current]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; });
  }
  function postPreview(post: Post) {
    return <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
      {post.publication && <p className="folio-meta sm:col-span-2">{post.publication.kind === 'dismissed' ? 'You dismissed this story. It remains in your saved plan.' : `Already shared ${post.publication.destination === 'instagram' ? 'on Instagram' : 'elsewhere'} · Sharing again will reuse an existing story.`}</p>}
      {post.imageUrl && <div style={{aspectRatio:(post.preview?.aspectRatio || "4:5").replace(":","/")}}><CarouselHero imageUrl={post.imageUrl} headline={post.title} headlinePosition={post.preview?.headlinePosition} watermarkText={post.preview?.watermarkText || "folio"} aspectRatio={post.preview?.aspectRatio} /></div>}
      <div><p className="folio-meta text-folio-text-secondary">{post.kind === 'room' ? 'Room story' : 'Project introduction'} · {post.status === 'draft_saved' ? 'Draft saved' : post.status === 'export_generated' ? 'Export generated' : 'Prepared post'}</p><h3 className="folio-h3 my-2">{post.title}</h3><p className="folio-body whitespace-pre-line">{post.caption}</p><Link href={`${post.editorHref}${post.editorHref.includes('?') ? '&' : '?'}release=${encodeURIComponent(projectId)}`} className="folio-ui mt-4 inline-block underline underline-offset-4">Review and edit this post</Link></div>
    </div>;
  }
  return <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
    {exit.dialog}<Link href="/designer/studio" className="folio-ui underline underline-offset-4">Back to Studio</Link>
    {error && <div role="alert" className="my-6 rounded-xl border border-folio-border-subtle p-4"><p className="folio-body">{error}</p>{!release && projectId && <button onClick={() => setAttempt(value => value + 1)} className="folio-ui mt-3 underline">Try again</button>}</div>}
    {!release && !error && <p role="status" className="folio-body my-8">Opening your release plan…</p>}
    {release && <>
      <p className="folio-meta mt-8 text-folio-text-secondary">Project release · {release.project.title}</p><h1 className="folio-h2 mt-3">{release.purpose}</h1><p className="folio-body mt-3 max-w-2xl">Start with the whole project, then choose the spaces you want people to spend more time with. You’ll have a saved sequence of posts to review and export individually.</p>
      {release.plan?.needsReview && <div className="my-5 rounded-xl border border-folio-border-subtle p-4"><p className="folio-body">The source work has changed since this plan was saved. Review the current posts before saving again. Stories no longer eligible will be removed only when you update your selection.</p><button disabled={pending} className="folio-ui mt-3 underline" onClick={() => { setItems(current => current.flatMap(item => { const option = release.options.find(post => post.sourceId === item.sourceId); return option ? [{ ...item, revision: option.revision }] : []; })); setSaved(false); setStep(0); }}>Use current supported stories</button></div>}
      <nav aria-label="Release plan steps" className="my-8 flex flex-wrap gap-5">{['Review introduction', 'Choose rooms', 'Review sequence'].map((label, index) => <button key={label} disabled={pending} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} className={`folio-ui pb-2 ${step === index ? 'border-b-2 border-current' : 'text-folio-text-secondary'}`}>{index + 1}. {label}</button>)}</nav>
      {step === 0 && <section aria-label="Project introduction">{!release.options.some(post => post.kind === 'introduction') && <p className="folio-body" role="status">A supported project introduction is not currently available. Your saved plan is preserved; return to the Studio to review the source work.</p>}{release.options.filter(post => post.kind === 'introduction').slice(0, 1).map(post => <div key={post.sourceId}>{postPreview(post)}</div>)}<button disabled={pending} onClick={() => setStep(1)} className="folio-ui mt-7 rounded-full bg-folio-text-primary px-5 py-3 text-white">Choose rooms →</button></section>}
      {step === 1 && <section aria-label="Choose favorite spaces"><h2 className="folio-h3">Which spaces would you like to share?</h2><p className="folio-body my-3 text-folio-text-secondary">These spaces have supported stories ready to review. Choose the ones that matter to you; none are selected for you. Choose one to three spaces.</p><div className="grid gap-4 sm:grid-cols-2">{!release.options.some(post => post.kind === 'room') && <p className="folio-body" role="status">No supported room stories are currently available for this plan.</p>}{release.options.filter(post => post.kind === 'room').map(post => <label key={post.sourceId} className="flex cursor-pointer gap-4 rounded-xl border border-folio-border-subtle p-4"><input type="checkbox" checked={items.some(item => item.sourceId === post.sourceId)} disabled={pending || (!items.some(item => item.sourceId === post.sourceId) && items.length >= 4)} onChange={event => select(post, event.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span>{post.imageUrl && <img src={post.imageUrl} alt="" className="mb-3 aspect-[4/3] w-full rounded-lg object-cover" />}<span className="folio-h4 block">{post.title}</span><span className="folio-body mt-2 line-clamp-3 block text-folio-text-secondary">{post.caption}</span></span></label>)}</div><button disabled={pending} onClick={() => setStep(2)} className="folio-ui mt-7 rounded-full bg-folio-text-primary px-5 py-3 text-white">Review selected posts →</button></section>}
      {step === 2 && <section aria-label="Review sequence"><h2 className="folio-h3">Your project, in sequence</h2><p className="folio-body my-3 text-folio-text-secondary">Move posts into your preferred order. Optional dates are planning notes only; Folio will not automatically publish these posts.</p><ol className="space-y-6">{items.map((item, index) => { const post = release.options.find(option => option.sourceId === item.sourceId); return <li key={item.sourceId} className="rounded-2xl border border-folio-border-subtle p-5">{post ? postPreview(post) : <p role="alert">This story is no longer available. Return to the Studio to refresh its source.</p>}<div className="mt-5 flex flex-wrap items-center gap-4"><span className="folio-meta">Post {index + 1}</span><button disabled={pending || index <= 1} aria-label={`Move ${post?.title || 'post'} up`} onClick={() => move(index, -1)} className="folio-ui underline disabled:opacity-40">Move up</button><button disabled={pending || index === 0 || index === items.length - 1} aria-label={`Move ${post?.title || 'post'} down`} onClick={() => move(index, 1)} className="folio-ui underline disabled:opacity-40">Move down</button><label className="folio-ui">Planning date <input type="date" value={item.planningDate || ''} disabled={pending} onChange={event => { setSaved(false); setItems(current => current.map((value, i) => i === index ? { ...value, planningDate: event.target.value || null } : value)); }} className="ml-2 rounded-lg border border-folio-border-subtle p-2" /></label></div></li>; })}</ol></section>}
      <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-folio-border-subtle pt-6"><button disabled={pending || items.length < 2 || (saved && !dirty)} onClick={save} className="folio-ui rounded-full bg-folio-text-primary px-5 py-3 text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save release plan'}</button>{saved && !dirty && <p role="status" className="folio-body">Release plan saved. Open each post to review its caption and export.</p>}</div>
    </>}
  </main>;
}
