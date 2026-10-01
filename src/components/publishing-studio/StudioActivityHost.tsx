'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ACTIVITY_FORMATS, createActivity, type ActivityBrief, type ActivityContext } from '@/lib/publishing-studio/activities';
import { StoryActivity, type ActivitySnapshot } from './StoryActivity';

async function request(url: string, body?: object, method = 'POST') {
  const response = await fetch(url, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load your activity. Please try again.');
  return data;
}

export function StudioActivityHost() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<{ context: ActivityContext; initial?: ActivitySnapshot; brief?: ActivityBrief } | null>(null);
  const [error, setError] = useState('');
  const creationKeys = useRef(new Map<string, string>());
  const completedRevision = useRef(new Map<string, number>());
  const query = params.toString();
  useEffect(() => {
    let cancelled = false;
    setState(null); setError('');
    (async () => {
      try {
        const search = new URLSearchParams(query);
        const data = await request('/api/publishing-studio/stories');
        const id = search.get('id');
        const subject = search.get('subject') || 'designer';
        const format = search.get('format') || 'twenty_questions';
        const resumeId = id || (subject === 'designer' && format === 'twenty_questions' ? data.personalIntroduction?.id : undefined);
        const initial = resumeId ? await request(`/api/publishing-studio/stories/${encodeURIComponent(resumeId)}`) : undefined;
        if (!['designer', 'firm', 'project'].includes(subject) || !Object.hasOwn(ACTIVITY_FORMATS, format)) throw new Error('Choose an available activity from the Studio.');
        const brief = { subject, format, ...(search.get('projectId') ? { projectId: search.get('projectId') } : {}), ...(search.get('roomId') ? { roomId: search.get('roomId') } : {}) } as ActivityBrief;
        if (!initial) createActivity(brief, data.context);
        if (!cancelled) setState({ context: data.context, initial, brief: initial?.definition.brief || brief });
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open your activity.'); }
    })();
    return () => { cancelled = true; };
  }, [query]);
  if (error) return <main className="p-8"><p role="alert" className="folio-body mb-4">{error}</p><Link href="/designer/studio" className="underline">Back to Studio</Link></main>;
  if (!state) return <p className="p-8 folio-body" role="status">Opening your activity…</p>;
  return <StoryActivity context={state.context} initial={state.initial} initialBrief={state.brief} chooseRoom={params.get('chooseRoom') === '1'} onClose={() => router.push('/designer/studio?tab=progress')} persistence={{
    create: brief => {
      const key = JSON.stringify(brief);
      if (!creationKeys.current.has(key)) creationKeys.current.set(key, globalThis.crypto.randomUUID());
      return request('/api/publishing-studio/stories', { brief, idempotencyKey: creationKeys.current.get(key) });
    },
    save: async snapshot => {
      const url = `/api/publishing-studio/stories/${encodeURIComponent(snapshot.id)}`;
      let saved = await request(url, { action: 'save', revision: Math.max(completedRevision.current.get(snapshot.id) || 0, snapshot.revision), answers: snapshot.answers, ...(!snapshot.reviewed ? { reviewed: false } : {}) }, 'PATCH');
      completedRevision.current.set(snapshot.id, saved.revision);
      if (snapshot.reviewed) {
        saved = await request(url, { action: 'review', revision: saved.revision }, 'PATCH');
        completedRevision.current.set(snapshot.id, saved.revision);
      }
      if (snapshot.reviewed && snapshot.draft) {
        saved = await request(url, { action: 'prepare', revision: saved.revision }, 'PATCH');
        completedRevision.current.set(snapshot.id, saved.revision);
        saved = await request(url, { action: 'edit_article', revision: saved.revision, draft: snapshot.draft }, 'PATCH');
        completedRevision.current.set(snapshot.id, saved.revision);
      }
      return saved;
    },
    publish: snapshot => request(`/api/publishing-studio/stories/${encodeURIComponent(snapshot.id)}`, { action: 'publish', revision: snapshot.revision, articleReviewed: snapshot.articleReviewed === true }, 'PATCH'),
  }} />;
}
