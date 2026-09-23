'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ExpertiseArticle, ExpertiseOpportunity } from '@/lib/publishing-studio/expertise/types';
import { useActivityExit } from '../UnsavedActivityDialog';
import { ExpertiseEvidence } from './ExpertiseEvidence';
import { ExpertiseArticleCover } from './ExpertiseArticleCover';
import { ExpertiseArticleView } from './ExpertiseArticleView';
import type { ExpertiseListing, ExpertiseSnapshot } from './transport';
const action = 'folio-ui underline underline-offset-4 disabled:opacity-50';
const field = 'w-full rounded-lg border border-folio-border-subtle bg-white p-3 folio-body';

export function ExpertiseWorkspace() {
  const params = useSearchParams(); const router = useRouter();
  const id = params.get('id'); const opportunityId = params.get('opportunity');
  const [snapshot, setSnapshot] = useState<ExpertiseSnapshot | null>(null);
  const [identity, setIdentity] = useState<ExpertiseSnapshot['identity'] | null>(null);
  const [opportunity, setOpportunity] = useState<ExpertiseOpportunity | null>(null);
  const [text, setText] = useState(''); const [correcting, setCorrecting] = useState(false);
  const [article, setArticle] = useState<ExpertiseArticle | null>(null);
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [preview, setPreview] = useState(false); const [notice, setNotice] = useState('');
  const [replacement, setReplacement] = useState<string[]>([]);
  function accept(next: ExpertiseSnapshot) { setSnapshot(next); setArticle(next.article); setOpportunity(next.opportunity); setIdentity(next.identity); setError(next.error || ''); setText(''); setCorrecting(false); }
  useEffect(() => {
    let cancelled = false;
    setError('');
    fetch(id ? `/api/publishing-studio/expertise/${encodeURIComponent(id)}` : '/api/publishing-studio/expertise', { cache: 'no-store' }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not open your article.');
      if (cancelled) return;
      if (id) accept(result); else { const found = (result as ExpertiseListing).opportunities.find(item => item.id === opportunityId); if (!found) throw new Error('This connection is no longer available. Return to My expertise to choose current work.'); setOpportunity(found); setIdentity((result as ExpertiseListing).identity || null); }
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open your article.'); });
    return () => { cancelled = true; };
  }, [id, opportunityId]);
  async function change(body: Record<string, unknown>): Promise<boolean> {
    if (!snapshot || pending) return false;
    setPending(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/publishing-studio/expertise/${encodeURIComponent(snapshot.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, expectedVersion: snapshot.version }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save this step. Your changes are still here.');
      if (result.id && result.session) accept(result); else if (body.action === 'export') setNotice('Social assets prepared from this reviewed article. This does not publish to Instagram.');
      return !result.error;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this step.'); return false; }
    finally { setPending(false); }
  }
  async function start() {
    if (!opportunity || pending) return;
    setPending(true); setError('');
    try { const response = await fetch('/api/publishing-studio/expertise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', opportunityId: opportunity.id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not start the interview.'); accept(result); router.replace(`/designer/studio/expertise?id=${encodeURIComponent(result.id)}`, { scroll: false }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the interview.'); }
    finally { setPending(false); }
  }
  const articleDirty = JSON.stringify(article ? { ...article, reviewed: false } : null) !== JSON.stringify(snapshot?.article ? { ...snapshot.article, reviewed: false } : null);
  const dirty = Boolean(text.trim()) || articleDirty;
  async function save() { return articleDirty ? change({ action: 'edit', article }) : text.trim() ? change({ action: correcting ? 'correct' : 'answer', text, evidenceIds: snapshot?.session.nextQuestion?.evidenceIds || [] }) : true; }
  const exit = useActivityExit(dirty, pending, save);
  const needsInterview = Boolean(snapshot && (snapshot.session.status !== 'ready' || (article && article.thesisRevision !== snapshot.session.thesisRevision)));
  const question = snapshot?.session.nextQuestion;
  const evidence = opportunity?.evidence || [];
  const questionEvidence = question?.evidenceIds.length ? evidence.filter(item => question.evidenceIds.includes(item.id)) : evidence;
  const author = { id: snapshot?.identity.profileUrl.split('/').pop()?.split('?')[0] || '', name: snapshot?.identity.name || null };
  function edit(next: ExpertiseArticle) { setArticle({ ...next, reviewed: false }); }
  async function downloadExcerpt(derivative: NonNullable<ExpertiseSnapshot['exports']>[number]) {
    // Recheck current source permission before preparing another downloadable copy.
    if (!await change({ action: 'export', reviewed: true })) return;
    const escaped = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
    const words = derivative.title.split(/\s+/); const lines: string[] = []; let line = '';
    for (const word of words) { if ((line + ' ' + word).length > 25 && line) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word; } if (line) lines.push(line);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#F5F3F0"/><text x="96" y="140" font-family="sans-serif" font-size="26" fill="#555">DESIGNER PERSPECTIVE</text><text x="96" y="380" font-family="Georgia, serif" font-size="56" fill="#222">${lines.map((value,index)=>`<tspan x="96" dy="${index ? 70 : 0}">${escaped(value)}</tspan>`).join('')}</text><text x="96" y="1140" font-family="sans-serif" font-size="30" fill="#222">${escaped(snapshot?.identity.name || 'The designer')}</text><text x="96" y="1220" font-family="Georgia, serif" font-size="36" fill="#222">FOLIO</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image(); image.src = url;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not prepare the title card. Try again.')); });
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Image downloads are unavailable in this browser.');
      context.drawImage(image, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the image.')), 'image/png'));
      const download = URL.createObjectURL(png); const anchor = document.createElement('a'); anchor.href = download; anchor.download = 'folio-expertise-title.png'; anchor.click(); URL.revokeObjectURL(download);
      setNotice('Title card downloaded as PNG. Exporting does not publish to Instagram.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not download this title card.'); }
    finally { URL.revokeObjectURL(url); }
  }
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    {exit.dialog}<Link className={action} href="/designer/studio#my-expertise">Back to My expertise</Link>
    <header><p className="folio-meta text-folio-text-secondary">My expertise</p><h1 className="folio-h1 mt-3">{opportunity?.readerBenefit || 'Your perspective, in your words'}</h1><p className="folio-body mt-4">{snapshot?.session.thesis || opportunity?.thesis}</p></header>
    {error && <p role="alert" className="folio-body">{error}</p>}{notice && <p role="status" className="folio-body">{notice}</p>}
    {!opportunity && !error && <p role="status">Opening your comparison…</p>}
    {!!snapshot?.sourceChanges.length && <section className="rounded-xl border border-folio-border-subtle p-5"><h2 className="folio-h3">Review changed sources</h2>{snapshot.sourceChanges.map(item => <p className="folio-body mt-2" key={item}>{item}</p>)}<p className="folio-meta mt-3">Your saved answers remain here. Replace affected evidence before publication.</p></section>}
    {opportunity && !snapshot && <><ExpertiseArticleCover compact title={opportunity.thesis} name={identity?.name} evidence={evidence} working /><p className="folio-body">Discuss what connects these projects. Folio will use your explanations and exact project photographs to prepare an editable article for your profile.</p><button disabled={pending} className={action} onClick={() => void start()}>{pending ? 'Opening interview…' : 'Start this article'}</button></>}
    {snapshot && (!article || needsInterview) && <>
      <details><summary className="cursor-pointer folio-ui">Your working article cover</summary><ExpertiseArticleCover compact title={snapshot.session.thesis} name={snapshot.identity.name} evidence={evidence} working /></details>
      <ExpertiseEvidence evidence={questionEvidence} />
      {snapshot.session.answers.some(answer => !answer.invalidated && !answer.skipped) && <details className="border-t border-folio-border-subtle py-4"><summary className="cursor-pointer folio-ui">Your saved context and answers</summary>{snapshot.session.answers.filter(answer => !answer.invalidated && !answer.skipped).map(answer => <p key={answer.id} className="folio-body mt-3 whitespace-pre-wrap">{answer.text}</p>)}</details>}
      {question && snapshot.session.status !== 'confirm' && <section className="max-w-3xl space-y-4"><h2 className="folio-h2">{correcting ? 'What should we understand differently?' : question.text}</h2><label className="block"><span className="sr-only">{correcting ? 'Correct the premise' : 'Your answer'}</span><textarea className={`${field} min-h-40`} value={text} onChange={event => setText(event.target.value)} /></label><div className="flex flex-wrap gap-5"><button disabled={pending || !text.trim()} className={action} onClick={() => void save()}>{pending ? 'Saving…' : correcting ? 'Save correction' : 'Save answer and continue'}</button><button disabled={pending} className={action} onClick={() => setCorrecting(value => !value)}>{correcting ? 'Return to question' : 'That’s not what happened'}</button><button disabled={pending || Boolean(text.trim())} className={action} onClick={() => void change({ action: 'skip' })}>Skip this question</button></div>{question.choices && <p className="folio-meta">You can move on, replace an example below, or save for later.</p>}</section>}
      {!question && snapshot.session.status === 'interview' && <button className={action} disabled={pending} onClick={() => void change({ action: 'continue' })}>Continue interview</button>}
      {snapshot.session.status === 'confirm' && <section className="space-y-4"><h2 className="folio-h2">Confirm the framing</h2><p className="folio-body">{snapshot.session.thesis}</p><button className={action} disabled={pending} onClick={() => void change({ action: 'confirm', text: 'These examples and this framing represent my thinking.' })}>This represents my thinking</button><label className="block max-w-3xl"><span className="folio-ui">Or correct the framing</span><textarea className={`${field} mt-2`} value={text} onChange={event => { setCorrecting(true); setText(event.target.value); }} /></label><button disabled={pending || !text.trim()} className={action} onClick={() => void change({ action: 'correct', text, evidenceIds: evidence.map(item => item.id) })}>Save corrected framing</button></section>}
      {snapshot.session.status === 'ready' && <button disabled={pending} className={action} onClick={() => void change({ action: 'compose' })}>{pending ? 'Preparing your article…' : article ? 'Prepare revised article' : 'Prepare my article'}</button>}
      {!!snapshot.session.coverage.gaps.length && <div className="folio-meta"><p>Still needed for this angle:</p><ul className="mt-2 list-disc pl-5">{snapshot.session.coverage.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul></div>}
    </>}
    {snapshot && article && !needsInterview && <>
      <div className="flex flex-wrap gap-5"><button className={action} onClick={() => setPreview(value => !value)}>{preview ? 'Edit article' : 'Preview article'}</button><button className={action} disabled={pending || !articleDirty} onClick={() => void change({ action: 'edit', article })}>Save article changes</button></div>
      {preview ? <ExpertiseArticleView article={article} author={author} /> : <section className="space-y-6">
        <label className="block"><span className="folio-ui">Article title</span><input className={`${field} mt-2`} value={article.title} onChange={event => edit({ ...article, title: event.target.value })} /></label>
        <label className="block"><span className="folio-ui">Introduction</span><textarea className={`${field} mt-2 min-h-32`} value={article.introduction} onChange={event => edit({ ...article, introduction: event.target.value })} /></label>
        {article.claims.map((claim, index) => <section key={claim.id}><label className="block"><span className="folio-ui">Passage {index + 1}</span><textarea className={`${field} mt-2 min-h-32`} value={claim.text} onChange={event => edit({ ...article, claims: article.claims.map(item => item.id === claim.id ? { ...item, text: event.target.value } : item) })} /></label><details className="mt-3"><summary className="cursor-pointer folio-meta">Inspect supporting evidence</summary><div className="mt-4"><ExpertiseEvidence evidence={evidence.filter(item => claim.evidenceIds.includes(item.id))} />{snapshot.session.answers.filter(answer => claim.answerIds.includes(answer.id)).map(answer => <p className="folio-body mt-3" key={answer.id}>{answer.text}</p>)}</div></details></section>)}
        {article.media.map(media => <section key={media.evidenceId} className="grid gap-4 sm:grid-cols-2"><img src={media.url} alt={media.alt} className="w-full rounded-xl" /><div className="space-y-3"><p className="folio-ui">{media.projectName} · {media.roomName}</p><label className="block"><span className="folio-meta">Caption</span><textarea className={field} value={media.caption} onChange={event => edit({ ...article, media: article.media.map(item => item.evidenceId === media.evidenceId ? { ...item, caption: event.target.value } : item) })} /></label><label className="block"><span className="folio-meta">Image description</span><input className={field} value={media.alt} onChange={event => edit({ ...article, media: article.media.map(item => item.evidenceId === media.evidenceId ? { ...item, alt: event.target.value } : item) })} /></label>{media.photographer && <p className="folio-meta">Photography: {media.photographer}</p>}</div></section>)}
        <fieldset className="space-y-3"><legend className="folio-h3">Cover presentation</legend><div className="flex flex-wrap gap-5">{(['project', ...(snapshot.identity.portraitUrl ? ['portrait'] : []), ...(snapshot.identity.logoUrl ? ['logo'] : [])] as ExpertiseArticle['cover'][]).map(cover => <label key={cover} className="flex gap-2 folio-body"><input type="radio" checked={article.cover === cover} onChange={() => edit({ ...article, cover, coverUrl: cover === 'portrait' ? snapshot.identity.portraitUrl : cover === 'logo' ? snapshot.identity.logoUrl : article.media[0]?.url })} />{cover === 'project' ? 'Project led' : cover === 'portrait' ? 'Portrait led' : 'Studio identity'}</label>)}</div>{article.cover === 'portrait' && article.coverUrl && <div className="grid gap-4 sm:grid-cols-2"><img src={article.coverUrl} alt="Portrait crop preview" className="aspect-[4/5] w-full max-w-sm rounded-xl object-cover" style={{ objectPosition: `${article.coverPosition?.x ?? 50}% ${article.coverPosition?.y ?? 50}%` }} /><div className="space-y-4">{(['x', 'y'] as const).map(axis => <label className="block folio-ui" key={axis}>{axis === 'x' ? 'Horizontal crop focus' : 'Vertical crop focus'}<input className="mt-2 block w-full" type="range" min="0" max="100" value={article.coverPosition?.[axis] ?? 50} onChange={event => edit({ ...article, coverPosition: { x: article.coverPosition?.x ?? 50, y: article.coverPosition?.y ?? 50, [axis]: Number(event.target.value) } })} /></label>)}</div></div>}<p className="folio-meta">Your project photographs remain the evidence. A portrait or logo is optional.</p></fieldset>
      </section>}
      <section className="space-y-4 border-t border-folio-border-subtle pt-6"><h2 className="folio-h2">Review and publish</h2><p className="folio-body">Publish a native article in your profile’s Expertise area. Sharing to Instagram remains a separate action.</p><label className="flex items-start gap-3 folio-body"><input className="mt-1" type="checkbox" checked={article.reviewed} onChange={event => setArticle({ ...article, reviewed: event.target.checked })} />I reviewed this article, its examples, captions, and credits.</label><button disabled={pending || articleDirty || !article.reviewed || Boolean(snapshot.sourceChanges.length)} className={`${action} ml-5`} onClick={() => void change({ action: 'publish', reviewed: true })}>{snapshot.publishedUrl ? 'Publish reviewed revision' : 'Publish article'}</button>{snapshot.publishedUrl && <div className="space-y-4"><Link className={action} href={snapshot.publishedUrl}>View published article</Link><label className="flex items-center gap-3 folio-body"><input type="checkbox" disabled={pending} checked={snapshot.article?.featured || false} onChange={event => void change({ action: 'feature', featured: event.target.checked })} />Feature on my profile</label><p className="folio-meta">Featuring does not pin the article to About or award editorial recognition.</p></div>}</section>
    </>}
    {snapshot && article && !needsInterview && <section className="space-y-4 border-t border-folio-border-subtle pt-6"><h2 className="folio-h2">Share your perspective</h2><p className="folio-body">Prepare a title card and caption from the reviewed article. These are downloads to share yourself.</p><button className={action} disabled={pending || articleDirty || !article.reviewed || Boolean(snapshot.sourceChanges.length)} onClick={() => void change({ action: 'export', reviewed: true })}>Prepare social preview</button>{articleDirty && <p className="folio-meta">Save your article changes, then review that version before publishing or preparing social assets.</p>}{snapshot.exports?.map(derivative => <article key={derivative.id} className="grid gap-5 sm:grid-cols-2"><div className="flex aspect-[4/5] flex-col justify-between rounded-xl bg-surface-ground p-6"><p className="folio-meta">Designer perspective</p><h3 className="folio-h2">{derivative.title}</h3><p className="folio-ui">{snapshot.identity.name} · Folio</p></div><div className="space-y-4"><p className="folio-meta">Prepared from article version {derivative.revision} · not posted</p><label className="block"><span className="folio-ui">Caption to copy</span><textarea readOnly className={`${field} mt-2 min-h-48`} value={derivative.caption} /></label><button className={action} disabled={pending || Boolean(snapshot.sourceChanges.length)} onClick={() => void downloadExcerpt(derivative)}>Download title card (PNG)</button></div></article>)}</section>}
    {snapshot && article && needsInterview && <details><summary className="cursor-pointer folio-ui">Last saved article · awaiting source review</summary><ExpertiseArticleView article={article} author={author} /></details>}
    {snapshot && <>
      <details className="border-t border-folio-border-subtle pt-5"><summary className="cursor-pointer folio-ui">Choose different evidence</summary><p className="folio-body mt-4">Choose examples from at least two projects. Changes return affected claims to review while preserving your saved answers.</p><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(snapshot.availableEvidence || evidence).filter(item => item.imageUrl).map(item => <label key={item.id} className="space-y-2"><img src={item.imageUrl} alt={item.alt || item.projectName} className="aspect-[4/3] w-full rounded-xl object-cover" /><span className="flex gap-2 folio-body"><input type="checkbox" checked={replacement.includes(item.id)} onChange={event => setReplacement(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{item.projectName} · {item.roomName}</span></label>)}</div><button className={`${action} mt-4`} disabled={pending || replacement.length < 2 || articleDirty || Boolean(text.trim())} onClick={() => void change({ action: 'replace', evidenceIds: replacement })}>Use these examples</button></details>
      <div className="flex flex-wrap gap-5"><button className={action} disabled={pending} onClick={async () => { if (await save()) router.push('/designer/studio?tab=progress'); }}>Save and leave</button><button className={`${action} text-folio-text-secondary`} disabled={pending || dirty} onClick={() => setArchiving(true)}>Archive this work</button></div>{dirty && <p className="folio-meta">Save your changes before archiving.</p>}
      {archiving && <section aria-label="Confirm archive" className="space-y-4 rounded-xl border border-folio-border-subtle p-5"><h2 className="folio-h3">Archive this work?</h2><p className="folio-body">{snapshot.publishedUrl ? 'This removes the published article from your profile and makes its public link unavailable. Copies already downloaded or shared elsewhere cannot be recalled.' : 'This removes the interview and article from In progress. Your saved record is retained.'}</p><div className="flex flex-wrap gap-5"><button className={action} disabled={pending} onClick={async () => { if (await change({ action: 'archive' })) router.push('/designer/studio?tab=progress'); }}>Confirm archive</button><button className={action} disabled={pending} onClick={() => setArchiving(false)}>Keep working</button></div></section>}
    </>}
  </main>;
}
