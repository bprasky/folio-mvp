'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from './useStudio';
import { StudioFeedCard, type FeedItem } from './StudioFeedCard';

/** The same feed and project filter used by the practice-wide Studio. */
export function ProjectSocialPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { data, error, reload } = useStudio(projectId);
  const href = `/designer/studio?project=${encodeURIComponent(projectId)}`;
  const [pending, setPending] = useState<string | null>(null);
  const [openError, setOpenError] = useState('');
  async function openItem(item: FeedItem) {
    setOpenError('');
    if (item.candidateId) { router.push(`${href}&candidate=${encodeURIComponent(item.candidateId)}`); return; }
    if (item.kind === 'carousel' && item.exportId && item.canPolish) {
      router.push(`/designer/projects/${encodeURIComponent(projectId)}/instagram?export=${encodeURIComponent(item.exportId)}&studio=project`);
      return;
    }
    if (item.kind !== 'suggestion' || !item.canPolish) { router.push(`${href}&item=${encodeURIComponent(item.id)}`); return; }
    setPending(item.id);
    try {
      const response = await fetch('/api/publishing-studio/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: item.id, revision: item.revision }) });
      const result = await response.json();
      if (!response.ok || !result.href) throw new Error(result.error || 'Could not open this post.');
      router.push(`${result.href}${result.href.includes('?') ? '&' : '?'}studio=project`);
    } catch (error) { setOpenError(error instanceof Error ? error.message : 'Could not open this post.'); }
    finally { setPending(null); }
  }
  return <section className="rounded-2xl border border-folio-border-subtle bg-surface-canvas p-5 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="folio-h3">Ready for your feed</h2><p className="folio-body mt-2 text-folio-text-secondary">Ideas and posts from this project.</p></div><Link href={href} className="folio-ui underline underline-offset-4">Open Publishing Studio</Link></div>
    {openError && <p role="alert" className="mt-4 folio-ui">{openError}</p>}{error ? <div className="mt-4 folio-ui" role="alert"><p>{error}</p><button onClick={reload} className="underline">Try again</button></div> : !data ? <p className="mt-4 folio-ui" role="status">Gathering your posts…</p> : <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.feed.filter(item => item.projectIds.includes(projectId) && item.status !== 'dismissed').slice(0, 3).map(item => <StudioFeedCard key={item.id} item={item} projectNames={data.projects.find(project => project.id === projectId)?.title || ''} onOpen={() => openItem(item)} pending={pending === item.id} disabled={pending !== null} />)}{!data.feed.some(item => item.projectIds.includes(projectId) && item.status !== 'dismissed') && <p className="folio-body text-folio-text-secondary">Your project’s available posts will appear here.</p>}</div>}
  </section>;
}
