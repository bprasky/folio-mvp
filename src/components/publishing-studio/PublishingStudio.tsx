'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useStudio } from './useStudio';
import { StudioFeedCard, type FeedItem, feedLabel } from './StudioFeedCard';
import { matchesStudioItem } from '@/lib/publishing-studio/navigation';

const CampaignWizard = dynamic(() => import('@/components/instagram/CampaignWizard').then(module => module.CampaignWizard), { ssr: false });
const fieldClass = 'max-w-full min-w-0 rounded-full border border-folio-border-subtle bg-surface-canvas px-4 py-2 folio-ui';
const actionClass = 'folio-ui underline underline-offset-4 disabled:opacity-50';

export function PublishingStudio() {
  const router = useRouter();
  const params = useSearchParams();
  const project = params.get('project') || '';
  const kind = params.get('type') || '';
  const query = params.get('q') || '';
  const status = params.get('status') || '';
  const { data, error, reload } = useStudio();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [campaignProject, setCampaignProject] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    // Old tab/create links now open this same workspace, without another chooser.
    next.delete('view'); next.delete('create');
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
    router.replace(`/designer/studio${next.size ? `?${next}` : ''}`, { scroll: false });
  }

  async function openItem(item: FeedItem) {
    setActionError('');
    if (item.kind === 'carousel' && item.exportId && item.canPolish) {
      router.push(`/designer/projects/${encodeURIComponent(item.projectIds[0])}/instagram?export=${encodeURIComponent(item.exportId)}&studio=${project ? 'project' : 'all'}`);
      return;
    }
    if (item.kind !== 'suggestion' || !item.canPolish) { navigate({ item: item.id }); return; }
    setPending(item.id);
    try {
      const response = await fetch('/api/publishing-studio/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: item.id, revision: item.revision }) });
      const result = await response.json();
      if (!response.ok || !result.href) throw new Error(result.error || 'Could not open this post. Please try again.');
      router.push(`${result.href}${result.href.includes('?') ? '&' : '?'}studio=${project ? 'project' : 'all'}`);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not open this post.'); }
    finally { setPending(null); }
  }

  async function discover() {
    setPending('discover'); setActionError(''); setNotice('');
    try {
      const response = await fetch('/api/publishing-studio/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
      const result = await response.json();
      if (!response.ok || result.status === 'llm_unavailable') throw new Error(result.error || 'Could not review your work right now.');
      setNotice(result.status === 'not_eligible' ? 'Cross-project recommendations begin after three published projects. Your available posts are below.' : result.createdPieces ? `${result.createdPieces} new story ideas added.` : 'No new connections this time. Your existing ideas are still here.');
      reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not review your work.'); }
    finally { setPending(null); }
  }

  async function updateIdea(id: string, nextStatus: string) {
    setPending(id); setActionError('');
    try {
      const response = await fetch(`/api/publishing-studio/ideas/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update this idea.');
      navigate({ item: null }); reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not update this idea.'); }
    finally { setPending(null); }
  }

  if (error || !data) return <main className="mx-auto max-w-6xl px-5 py-12"><h1 className="folio-h1">Publishing Studio</h1><p role={error ? 'alert' : 'status'} className="mt-6 folio-body">{error || 'Gathering ideas from your work…'}</p>{error && <button onClick={reload} className={`${actionClass} mt-5`}>Try again</button>}</main>;
  const projectName = (id: string) => data.projects.find(item => item.id === id)?.title || 'Project';
  const activeCampaign = data.projects.find(item => item.id === campaignProject);
  const selectedProject = data.projects.find(item => item.id === project);
  const feed = data.feed.filter(item => matchesStudioItem({ ...item, title: `${item.title} ${item.caption} ${item.projectIds.map(projectName).join(' ')}` }, { project, query, status }) && (!kind || item.kind === kind) && (status || item.status !== 'dismissed'));
  const selected = data.feed.find(item => item.id === params.get('item') || item.id === `idea:${params.get('item')}` || item.exportId === params.get('item') || item.campaignId === params.get('item'));
  const campaign = selected?.campaignId ? data.campaigns.find(item => item.id === selected.campaignId) : undefined;
  const idea = selected?.kind === 'idea' ? data.ideas.find(item => item.id === selected.id || selected.id === `idea:${item.id}`) : undefined;

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
    <header><p className="folio-meta uppercase tracking-widest text-folio-text-secondary">{data.workspace.name}</p><h1 className="folio-h1 mt-2">Publishing Studio</h1><p className="folio-body mt-2 text-folio-text-secondary">Something worth sharing, already taking shape.</p></header>
    <div className="relative my-6 flex flex-wrap items-center gap-3">
      <label className="min-w-0"><span className="sr-only">Project</span><select className={fieldClass} value={project} onChange={event => navigate({ project: event.target.value, item: null })}><option value="">All projects</option><option value="studio-wide">Studio-wide</option>{data.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="min-w-0"><span className="sr-only">Content type</span><select className={fieldClass} value={kind} onChange={event => navigate({ type: event.target.value, item: null })}><option value="">All ideas & posts</option><option value="suggestion">Proposed posts</option><option value="carousel">Saved carousels</option><option value="campaign">Campaigns</option><option value="idea">Story directions</option></select></label>
      <details><summary className="cursor-pointer folio-meta text-folio-text-secondary">Filters</summary><div className="absolute left-0 top-full z-20 mt-2 grid w-64 max-w-full gap-3 rounded-xl border border-folio-border-subtle bg-surface-canvas p-4 shadow-sm"><label className="grid gap-1 folio-meta">Search<input className={fieldClass} type="search" value={query} onChange={event => navigate({ q: event.target.value })} /></label><label className="grid gap-1 folio-meta">Status<select className={fieldClass} value={status} onChange={event => navigate({ status: event.target.value })}><option value="">All statuses</option>{['recommended', 'in_progress', 'draft', 'generated', 'exported', 'dismissed'].map(value => <option key={value} value={value}>{feedLabel(value)}</option>)}</select></label></div></details>
      <button className="ml-auto inline-flex items-center gap-1.5 py-2 folio-meta text-folio-text-secondary disabled:opacity-50" disabled={pending !== null} onClick={discover}><Sparkles className="h-4 w-4" aria-hidden="true" />{pending === 'discover' ? 'Looking for connections…' : 'Find more connections'}</button>
    </div>
    {selectedProject && <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="folio-h3">{selectedProject.title}</h2><Link href={`/project/${encodeURIComponent(project)}`} className="folio-meta text-folio-text-secondary underline underline-offset-4">View project</Link></div>}
    {notice && <p role="status" className="mb-5 folio-ui">{notice}</p>}{actionError && <p role="alert" className="mb-5 folio-ui">{actionError}</p>}
    {selected && <section aria-label={selected.title} className="mb-6 rounded-xl border border-folio-border-subtle p-5"><div className="flex items-start justify-between gap-4"><h2 className="folio-h3">{selected.title}</h2><button className={actionClass} onClick={() => navigate({ item: null })}>Close</button></div><p className="folio-body mt-3 whitespace-pre-wrap">{selected.caption}</p>{campaign && <ol className="mt-5 space-y-4">{campaign.posts.map(post => <li key={post.id}><h3 className="folio-ui">{post.sequenceNum}. {post.title}</h3><p className="folio-body mt-1 whitespace-pre-wrap text-folio-text-secondary">{post.caption}</p></li>)}</ol>}{idea && <><p className="folio-meta mt-4 text-folio-text-secondary">This direction needs your perspective before it becomes a finished post.</p>{idea.prompts.map(prompt => <p key={prompt.id} className="folio-body mt-3">{prompt.prompt}</p>)}<div className="mt-4 flex flex-wrap gap-4">{idea.status === 'recommended' && <button disabled={pending !== null} className={actionClass} onClick={() => updateIdea(idea.id, 'in_progress')}>Keep this direction</button>}{['recommended', 'in_progress'].includes(idea.status) && <button disabled={pending !== null} className={actionClass} onClick={() => updateIdea(idea.id, 'dismissed')}>Dismiss</button>}{idea.status === 'dismissed' && <button disabled={pending !== null} className={actionClass} onClick={() => updateIdea(idea.id, 'recommended')}>Restore</button>}</div></>}{!selected.canPolish && selected.kind === 'suggestion' && <p className="folio-meta mt-3">Editing this project’s social posts is not available for your account.</p>}</section>}
    {feed.length ? <section aria-label="Ideas and posts" className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{feed.map(item => <StudioFeedCard key={item.id} item={item} projectNames={item.projectIds.map(projectName).join(' · ')} onOpen={() => openItem(item)} onCampaign={['suggestion', 'carousel'].includes(item.kind) && data.projects.find(project => project.id === item.projectIds[0])?.canCreateCampaign ? () => setCampaignProject(item.projectIds[0]) : undefined} pending={pending === item.id} disabled={pending !== null} />)}</section> : <p className="py-8 folio-body text-folio-text-secondary">{project || kind || query || status ? 'No posts match this selection. Try another project or clear your filters.' : 'Publish a project with photos to bring your first proposed posts here.'}</p>}
    {data.truncated && <p role="status" className="mt-6 folio-meta text-folio-text-secondary">Showing recent work. Older records may not appear in these results.</p>}
    {activeCampaign && <CampaignWizard projectId={activeCampaign.id} projectTitle={activeCampaign.title} onClose={() => { setCampaignProject(null); reload(); }} />}
  </main>;
}
