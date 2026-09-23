'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { usePersonalIntroduction } from './usePersonalIntroduction';
import { useStudio } from './useStudio';
import { StudioFeedCard, type FeedItem } from './StudioFeedCard';
import { recommendStudioStories } from '@/lib/publishing-studio/recommendations';
import { StudioIntro, StudioTabs, type StudioTab } from './StudioWorkspace';
import { StudioDiscovery, AboutMeInvitation, ActivityInvitations, matchesStoryFormat } from './StudioDiscovery';
import { StudioReleaseOpportunities, useReleaseOpportunities } from './StudioReleaseOpportunities';
import { StudioSavedActivities } from './StudioSavedActivities';
import { ExpertiseSection } from './expertise/ExpertiseSection';
import { matchesStudioItem } from '@/lib/publishing-studio/navigation';

const CampaignWizard = dynamic(() => import('@/components/instagram/CampaignWizard').then(module => module.CampaignWizard), { ssr: false });
const fieldClass = 'max-w-full min-w-0 rounded-full border border-folio-border-subtle bg-surface-canvas px-4 py-2 folio-ui';
const actionClass = 'folio-ui underline underline-offset-4 disabled:opacity-50';

export function PublishingStudio({ embedded = false, expertiseEnabled = false }: { embedded?: boolean; expertiseEnabled?: boolean } = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const project = params.get('project') === 'studio-wide' ? '' : params.get('project') || '';
  const tab: StudioTab = params.get('tab') === 'exports' ? 'exports' : params.get('tab') === 'progress' || (!params.get('tab') && params.get('view') === 'saved') ? 'progress' : 'suggestions';
  const kind = params.get('type') || '';
  const subject = params.get('subject') === 'about-me' ? 'about-me' : project;
  const format = params.get('format') || '';
  const query = params.get('q') || '';
  const status = params.get('status') || '';
  const { data, error, reload } = useStudio();
  const {introduction,error:introductionError,reload:reloadIntroduction}=usePersonalIntroduction();
  const releases=useReleaseOpportunities();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [campaignProject, setCampaignProject] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [removingDraft, setRemovingDraft] = useState<FeedItem | null>(null);

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    // Old tab/create links now open this same workspace, without another chooser.
    if (next.get('view') !== 'saved') next.delete('view');
    next.delete('create');
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
    router.replace(`/designer/studio${next.size ? `?${next}` : ''}`, { scroll: false });
  }

  async function openItem(item: FeedItem) {
    setActionError('');
    if (item.kind === 'carousel' && item.exportId && item.canPolish) {
      router.push(`/designer/projects/${encodeURIComponent(item.projectIds[0])}/instagram?export=${encodeURIComponent(item.exportId)}&studio=${project && project !== 'cross-project' ? 'project' : 'all'}`);
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

  async function removeDraft() {
    if (!removingDraft?.exportId) return;
    setPending(removingDraft.id); setActionError(''); setNotice('');
    try {
      const response = await fetch(`/api/publishing-studio/drafts/${encodeURIComponent(removingDraft.exportId)}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updatedAt: removingDraft.updatedAt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not remove this draft.');
      setRemovingDraft(null); setNotice('Draft removed. Its original suggestion can return if the source is still available.');
      navigate({ item: null }); reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not remove this draft.'); }
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

  if (error || !data) return <section className="mx-auto max-w-6xl px-5 py-12"><h1 className="folio-h1">Publishing Studio</h1><p role={error ? 'alert' : 'status'} className="mt-6 folio-body">{error || 'Gathering ideas from your work…'}</p>{error && <button onClick={reload} className={`${actionClass} mt-5`}>Try again</button>}</section>;
  if (embedded && !data.feed.length && !data.campaigns.length) return null;
  const projectName = (id: string) => data.projects.find(item => item.id === id)?.title || 'Project';
  const activeCampaign = data.projects.find(item => item.id === campaignProject);
  const selectedProject = data.projects.find(item => item.id === project);
  const feed = data.feed.filter(item => (!data.readinessEnabled || ['carousel', 'campaign'].includes(item.kind)) && matchesStudioItem({ ...item, title: `${item.title} ${item.caption} ${item.projectIds.map(projectName).join(' ')}` }, { project, query, status }) && (!kind || item.kind === kind) && (tab !== 'suggestions' || (subject !== 'about-me' && matchesStoryFormat(item, format))) && (status || item.status !== 'dismissed'));
  const selected = data.feed.find(item => item.id === params.get('item') || item.id === `idea:${params.get('item')}` || item.exportId === params.get('item') || item.campaignId === params.get('item'));
  const campaign = selected?.campaignId ? data.campaigns.find(item => item.id === selected.campaignId) : undefined;
  const idea = selected?.kind === 'idea' ? data.ideas.find(item => item.id === selected.id || selected.id === `idea:${item.id}`) : undefined;

  const releaseGroups = subject==='about-me'||format ? [] : releases.opportunities.filter(item=>(!project||item.projectId===project)&&(!query||item.projectTitle.toLowerCase().includes(query.toLowerCase())));
  const groupedIds = new Set(releaseGroups.flatMap(item=>item.sourceIds));
  const recommendations = recommendStudioStories(data, feed.filter(item=>!groupedIds.has(item.id)));
  const recommendedIds = new Set(recommendations.flatMap(group => group.cards.map(card => card.id)));
  const ranked = recommendations.flatMap(group => group.cards);
  const primary = ranked.slice(0, Math.max(1,3-(releaseGroups.length?1:0)-(!subject&&!format&&introduction?.status!=='published'?1:0)));
  const portfolio = ranked.slice(primary.length).find(card => card.kind === 'idea' && card.projectIds.length > 1 && card.imageUrls.length > 0);
  const remaining = ranked.slice(primary.length).filter(card => card.id !== portfolio?.id);
  const archiveIds = new Set(recommendations.filter(group => group.label === 'From your archive').flatMap(group => group.cards.map(card => card.id)));
  const archive = remaining.filter(card => archiveIds.has(card.id));
  const additional = remaining.filter(card => !archiveIds.has(card.id));
  const saved = feed.filter(card => card.kind !== 'suggestion' && !recommendedIds.has(card.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  const emptyCampaigns = data.campaigns.filter(item => item.postCount === 0 &&
    matchesStudioItem({ title: item.title, projectIds: [item.projectId], status: 'draft' }, { project, query, status }) && (!kind || kind === 'campaign'));
  const renderCard = (item: FeedItem) => <StudioFeedCard key={item.id} item={item} projectNames={item.projectIds.map(projectName).join(' · ')} onOpen={() => openItem(item)} onRemove={item.kind === 'carousel' && item.exportId && item.status === 'draft' && item.canPolish ? () => setRemovingDraft(item) : undefined} pending={pending === item.id} disabled={pending !== null} />;

  return <section className={embedded ? 'space-y-6' : 'mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-8'}>
    {removingDraft && <section aria-label="Confirm draft removal" className="mb-6 rounded-xl border border-folio-border-subtle p-5"><h2 className="folio-h3">Remove “{removingDraft.title || 'Untitled draft'}”?</h2><p className="folio-body mt-2">This discards the saved draft and its changes. The original suggestion can return if its source is still available.</p><div className="mt-4 flex flex-wrap gap-4"><button type="button" className={actionClass} disabled={pending !== null} onClick={() => setRemovingDraft(null)}>Keep draft</button><button type="button" className={actionClass} disabled={pending !== null} onClick={removeDraft}>{pending === removingDraft.id ? 'Removing…' : 'Remove saved draft'}</button></div></section>}
    {!embedded && <><StudioIntro /><StudioTabs value={tab} onChange={value => navigate({ tab: value, item: null })} /></>}

    <div className="mb-6 flex flex-wrap items-center gap-3">
    {!embedded && <StudioDiscovery onClear={() => navigate({ subject: null, project: null, format: null, type: null, item: null })} projects={data.projects} subject={subject} format={format} onSubject={value => navigate({ subject: value === 'about-me' ? value : null, project: value === 'about-me' ? null : value, format: null, item: null })} onFormat={value => navigate({ format: value, type: null, item: null })} />}
      <label className="min-w-0"><span className="sr-only">Search stories</span><input className={fieldClass} type="search" placeholder="Search your stories" value={query} onChange={event => navigate({ q: event.target.value })} /></label>
      {(kind || status || query) && <button className={actionClass} onClick={() => navigate({ type: null, status: null, q: null })}>Clear filters</button>}

    </div>
    {selectedProject && <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="folio-h3">{selectedProject.title}</h2>{selectedProject.canCreateCampaign && <button className={actionClass} disabled={pending !== null} onClick={() => setCampaignProject(selectedProject.id)}>Build a campaign</button>}<Link href={`/project/${encodeURIComponent(project)}`} className="folio-meta text-folio-text-secondary underline underline-offset-4">View project</Link></div>}
    {notice && <p role="status" className="mb-5 folio-ui">{notice}</p>}{actionError && <p role="alert" className="mb-5 folio-ui">{actionError}</p>}
    {selected && <section aria-label={selected.title} className="mb-6 rounded-xl border border-folio-border-subtle p-5"><div className="flex items-start justify-between gap-4"><h2 className="folio-h3">{selected.title}</h2><button className={actionClass} onClick={() => navigate({ item: null })}>Close</button></div><p className="folio-body mt-3 whitespace-pre-wrap">{selected.caption}</p>{campaign && <ol className="mt-5 space-y-4">{campaign.posts.map(post => <li key={post.id}><h3 className="folio-ui">{post.sequenceNum}. {post.title}</h3><p className="folio-body mt-1 whitespace-pre-wrap text-folio-text-secondary">{post.caption}</p></li>)}</ol>}{idea && <><p className="folio-meta mt-4 text-folio-text-secondary">This direction needs your perspective before it becomes a finished post.</p>{idea.prompts.map(prompt => <p key={prompt.id} className="folio-body mt-3">{prompt.prompt}{prompt.optionA && prompt.optionB && <span className="mt-1 block folio-meta">{prompt.optionA} or {prompt.optionB}</span>}</p>)}<div className="mt-4 flex flex-wrap gap-4">{idea.status === 'recommended' && <button disabled={pending !== null} className={actionClass} onClick={() => updateIdea(idea.id, 'in_progress')}>Keep this direction</button>}{['recommended', 'in_progress'].includes(idea.status) && <button disabled={pending !== null} className={actionClass} onClick={() => updateIdea(idea.id, 'dismissed')}>Dismiss</button>}{idea.status === 'dismissed' && <button disabled={pending !== null} className={actionClass} onClick={() => updateIdea(idea.id, 'recommended')}>Restore</button>}</div></>}{!selected.canPolish && selected.kind === 'suggestion' && <p className="folio-meta mt-3">Editing this project’s social posts is not available for your account.</p>}</section>}
    <div role={embedded ? undefined : "tabpanel"} id={embedded ? undefined : "studio-panel"} aria-labelledby={embedded ? undefined : `studio-tab-${tab === 'exports' ? 'progress' : tab}`} className="space-y-8">
      {tab === 'suggestions' && <>
        {subject !== 'about-me' && format !== 'twenty_questions' && <section aria-label="Your next stories"><header className="mb-5"><h2 className="folio-h3 sm:folio-h2">{project || format ? 'Stories to explore' : 'Recommended for you'}</h2></header>
          {primary.length || releaseGroups.length || (!subject && !format) ? <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">{!embedded&&<StudioReleaseOpportunities cardsOnly opportunities={releaseGroups.slice(0,1)}/>}
            {!subject && !format && <AboutMeInvitation compact introduction={introduction?.status==='published'?null:introduction} />}{primary.map(renderCard)}</div> : <p className="folio-body text-folio-text-secondary">{project || kind || query || status ? 'No posts match this selection. Try another project or clear your filters.' : 'No prepared stories yet. Useful introductions need a coherent published overview and suitable photography; focused stories need supported detail.'}</p>}
        </section>}
    {!data.readinessEnabled && tab === 'suggestions' && subject !== 'about-me' && <button className="ml-auto inline-flex items-center gap-1.5 py-2 folio-meta text-folio-text-secondary disabled:opacity-50" disabled={pending !== null} onClick={discover}><Sparkles className="h-4 w-4" aria-hidden="true" />{pending === 'discover' ? 'Looking for connections…' : 'Find more connections'}</button>}
    {!embedded && expertiseEnabled && <ExpertiseSection />}
        {!embedded&&releases.error&&<p role="status" className="folio-meta">{releases.error} <button className={actionClass} onClick={releases.retry}>Try again</button></p>}
        {introductionError && <p role="status" className="folio-meta text-folio-text-secondary">{introductionError} <button className={actionClass} onClick={()=>void reloadIntroduction()}>Try again</button></p>}
        {!embedded && <ActivityInvitations introduction={introduction} omitTwenty={!subject && !format} project={selectedProject} format={format} personal={!project || subject === 'about-me'} />}
        {(releaseGroups.length > 1 || portfolio || archive.length > 0 || additional.length > 0) && <section aria-label="From your projects">
          <h2 className="folio-h2 mb-5">From your projects</h2>
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {!embedded && <StudioReleaseOpportunities cardsOnly opportunities={releaseGroups.slice(1)} />}
            {portfolio && renderCard(portfolio)}{archive.map(renderCard)}{additional.map(renderCard)}
          </div>
        </section>}
        {subject !== 'about-me' && !selectedProject && data.projects.some(item => item.canCreateCampaign) && <details className="border-t border-folio-border-subtle pt-4"><summary className="cursor-pointer folio-ui">Project campaigns</summary><div className="mt-3 flex flex-wrap gap-4">{data.projects.filter(item => item.canCreateCampaign).map(item => <button key={item.id} className={actionClass} disabled={pending !== null} onClick={() => setCampaignProject(item.id)}>Build a campaign for {item.title}</button>)}</div></details>}
      </>}
      {tab === 'progress' && <section aria-label="Saved work"><header className="mb-5"><h2 className="folio-h2">{embedded ? "Earlier saved work" : "Saved work"}</h2><p className="folio-body mt-2 text-folio-text-secondary">Your drafts, generated work and kept directions. Generated work is not confirmed publication.</p></header>
        {!embedded && <>{expertiseEnabled && <ExpertiseSection saved />}<StudioSavedActivities /><StudioReleaseOpportunities saved opportunities={releases.plans.filter(item=>!project||item.projectId===project)} loading={releases.loading} error={releases.error} onRetry={releases.retry}/></>}
        {saved.length > 0 && <div className="grid grid-cols-1 gap-x-5 gap-y-8 md:grid-cols-2 lg:grid-cols-3">{saved.map(renderCard)}</div>}
        {emptyCampaigns.map(item => <article key={item.id} className="mt-4 border-t border-folio-border-subtle pt-4"><h3 className="folio-h3">{item.title}</h3><p className="folio-body mt-2">Campaign saved without generated posts.</p><Link href={`/project/${encodeURIComponent(item.projectId)}`} className={actionClass}>View project</Link>{data.projects.find(project => project.id === item.projectId)?.canCreateCampaign && <button className={`${actionClass} ml-4`} onClick={() => setCampaignProject(item.projectId)}>Start a new campaign</button>}</article>)}
        {!saved.length && !emptyCampaigns.length && <p className="folio-body text-folio-text-secondary">{embedded ? "No earlier carousels or campaigns match this selection." : "No saved carousels or campaigns match this selection."}</p>}
      </section>}
      {tab === 'exports' && <section aria-label="Saved export availability"><h2 className="folio-h3">{embedded ? "Earlier generated files" : "No stored download packages"}</h2><p className="folio-body mt-2 text-folio-text-secondary">Saved work can be reopened to prepare a download. Earlier generated files are not stored here, and generation does not confirm publication.</p><button className={`${actionClass} mt-4`} onClick={() => navigate({ tab: 'progress', item: null })}>Open saved work</button></section>}
    </div>
    {data.truncated && <p role="status" className="mt-6 folio-meta text-folio-text-secondary">Showing recent work. Older records may not appear in these results.</p>}
    {activeCampaign && <CampaignWizard projectId={activeCampaign.id} projectTitle={activeCampaign.title} onClose={() => { setCampaignProject(null); reload(); }} />}
  </section>;
}
