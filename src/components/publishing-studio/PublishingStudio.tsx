'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, Layers3, Newspaper, Sparkles } from 'lucide-react';
import { useStudio } from './useStudio';
import { matchesStudioItem, parseStudioView, STUDIO_VIEWS, studioHref } from '@/lib/publishing-studio/navigation';

const CampaignWizard = dynamic(() => import('@/components/instagram/CampaignWizard').then(module => module.CampaignWizard), { ssr: false });
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-full border border-folio-border-subtle px-5 py-2.5 folio-ui hover:bg-surface-ground disabled:opacity-50';
const cardClass = 'min-w-0 rounded-2xl border border-folio-border-subtle bg-surface-canvas p-5 md:p-6';
const fieldClass = 'min-w-0 rounded-xl border border-folio-border-subtle bg-surface-canvas px-3 py-2.5 folio-ui';
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const formatLabel = (value: string) => value === 'QA' ? 'Q&A' : label(value.toLowerCase());

export function PublishingStudio() {
  const router = useRouter();
  const params = useSearchParams();
  const view = parseStudioView(params.get('view'));
  const project = params.get('project') || '';
  const query = params.get('q') || '';
  const status = params.get('status') || '';
  const sort = params.get('sort') || 'recent';
  const selectedItem = params.get('item');
  const creation = params.get('create');
  const { data, error, reload } = useStudio();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [campaignProject, setCampaignProject] = useState<string | null>(null);

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key);
    router.replace(`/designer/studio?${next}`, { scroll: false });
  }

  async function updateIdea(id: string, nextStatus: string) {
    setPending(id); setActionError(''); setNotice('');
    try {
      const response = await fetch(`/api/publishing-studio/ideas/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update this idea.');
      setNotice(nextStatus === 'dismissed' ? 'Idea dismissed. You can restore it from the Dismissed filter.' : 'Idea saved to your editorial shortlist.');
      reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not update this idea.'); }
    finally { setPending(null); }
  }

  async function discover() {
    setPending('discover'); setActionError(''); setNotice('');
    try {
      const response = await fetch('/api/publishing-studio/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not review your work.');
      if (result.status === 'llm_unavailable') throw new Error('Folio could not review your work right now. Your existing ideas are safe; please try again later.');
      setNotice(result.status === 'not_eligible'
        ? 'Story recommendations begin after three published projects in this workspace. You can still create posts and campaigns now.'
        : result.status === 'no_signals' || !result.createdPieces
          ? 'No new story ideas this time. Your existing recommendations and shortlist are below.'
          : `Folio found ${result.createdPieces} new story ${result.createdPieces === 1 ? 'idea' : 'ideas'} across your published work.`);
      reload();
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not review your work.'); }
    finally { setPending(null); }
  }

  if (error) return <main className="mx-auto max-w-6xl px-5 py-12"><h1 className="folio-h1">Publishing Studio</h1><p role="alert" className="mt-6 folio-body">{error}</p><button onClick={reload} className={`${buttonClass} mt-5`}>Try again</button></main>;
  if (!data) return <main className="mx-auto max-w-6xl px-5 py-12"><h1 className="folio-h1">Publishing Studio</h1><p role="status" className="mt-6 folio-body">Gathering your stories and social work…</p></main>;

  const selectedProject = data.projects.find(item => item.id === project);
  const projectName = (id: string) => data.projects.find(item => item.id === id)?.title || 'Project';
  const filter = { project, query, status };
  function order<T>(items: T[], title: (item: T) => string, date: (item: T) => string, attention: (item: T) => boolean) {
    return [...items].sort((a, b) => sort === 'project' ? title(a).localeCompare(title(b)) : sort === 'attention' && attention(a) !== attention(b) ? Number(attention(b)) - Number(attention(a)) : date(b).localeCompare(date(a)));
  }
  const ideas = order(data.ideas.filter(item => matchesStudioItem({ ...item, title: `${item.title} ${item.projectIds.map(projectName).join(' ')}` }, filter) && (status || item.status !== 'dismissed')), item => item.projectIds.map(projectName).join(' '), item => item.createdAt, item => item.status === 'in_progress');
  const posts = order(data.posts.filter(item => matchesStudioItem({ ...item, title: `${item.title} ${projectName(item.projectId)}`, projectIds: [item.projectId] }, filter)), item => projectName(item.projectId), item => item.updatedAt, item => item.status === 'draft');
  const editorials = order(data.editorials.filter(item => matchesStudioItem({ ...item, projectIds: [item.projectId] }, filter)), item => projectName(item.projectId), item => item.updatedAt, item => item.status !== 'published');
  const publishedStories = editorials.filter(item => item.status === 'published');
  const campaigns = order(data.campaigns.filter(item => matchesStudioItem({ ...item, projectIds: [item.projectId], status: item.postCount < item.totalPosts ? 'incomplete' : 'generated' }, filter)), item => projectName(item.projectId), item => item.createdAt, item => item.postCount < item.totalPosts);
  const availableProjects = data.projects.filter(item => (creation === 'campaign' ? item.canCreateCampaign : item.canCreate) && (!project || item.id === project));
  const activeCampaign = data.projects.find(item => item.id === campaignProject);
  const statuses = view === 'editorial' ? ['recommended', 'in_progress', 'dismissed', 'draft', 'completed', 'scheduled', 'published'] : view === 'campaigns' ? ['generated', 'incomplete'] : view === 'posts' ? ['draft', 'generated', 'exported'] : [];

  function sourceLinks(ids: string[]) {
    return <div className="mt-3 flex flex-wrap gap-2">{ids.length ? ids.map(id => <Link key={id} className="rounded-full bg-surface-ground px-3 py-1 folio-meta text-folio-text-secondary hover:underline" href={studioHref(view, id)}>{projectName(id)}</Link>) : <span className="folio-meta text-folio-text-secondary">Studio-wide</span>}</div>;
  }

  function renderIdeas(limit?: number) {
    const items = limit ? ideas.slice(0, limit) : ideas;
    if (!items.length) return <Empty title="Room for your next story" text="Folio can look across your published projects for material studies, Q&As, and stories about your approach. Recommendations begin after three published project stories." />;
    return <div className="grid gap-4 md:grid-cols-2">{items.map(idea => <article key={idea.id} className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2 folio-meta text-folio-text-secondary"><span>{formatLabel(idea.format)}</span><span>{idea.status === 'in_progress' ? 'Shortlisted' : label(idea.status)}</span></div>
      <h3 className="folio-h3 mt-3 break-words">{idea.title}</h3>
      <p className="folio-body mt-3 text-folio-text-secondary">{idea.reason}</p>
      {sourceLinks(idea.projectIds)}
      <details className="mt-5"><summary className="cursor-pointer folio-ui underline underline-offset-4">Explore the story{idea.prompts.length ? ` · ${idea.prompts.length} ${idea.prompts.length === 1 ? 'question' : 'questions'}` : ''}</summary><div className="mt-4 space-y-3">{idea.prompts.map(prompt => <div key={prompt.id} className="border-l-2 border-folio-border-subtle pl-4"><p className="folio-ui">{prompt.prompt}</p>{prompt.hint && <p className="folio-meta mt-1 text-folio-text-secondary">{prompt.hint}</p>}</div>)}<p className="folio-meta text-folio-text-secondary">Save this direction to your shortlist. Answering and publishing these new editorial stories is not available yet.</p></div></details>
      <div className="mt-5 flex flex-wrap gap-4 folio-ui">
        {idea.status === 'recommended' && <button disabled={pending !== null} className="underline underline-offset-4 disabled:opacity-50" onClick={() => updateIdea(idea.id, 'in_progress')}>Shortlist story</button>}
        {['recommended', 'in_progress'].includes(idea.status) && <button disabled={pending !== null} className="text-folio-text-secondary underline underline-offset-4 disabled:opacity-50" onClick={() => updateIdea(idea.id, 'dismissed')}>Dismiss</button>}
        {idea.status === 'dismissed' && <button disabled={pending !== null} className="underline underline-offset-4 disabled:opacity-50" onClick={() => updateIdea(idea.id, 'recommended')}>Restore idea</button>}
      </div>
    </article>)}</div>;
  }

  function renderPosts(limit?: number) {
    const items = limit ? posts.slice(0, limit) : posts;
    if (!items.length) return <Empty title="Your social pieces live here" text="Create a carousel from a published project, or find individual pieces from a saved campaign. Project pages show this same work." />;
    return <div className="grid gap-4 md:grid-cols-2">{items.map(post => <article key={post.id} className={cardClass}>
      <div className="flex flex-wrap justify-between gap-2 folio-meta text-folio-text-secondary"><span>{post.kind === 'carousel' ? 'Carousel' : 'Campaign piece'}</span><span>{label(post.status)}</span></div>
      <h3 className="folio-h3 mt-3 break-words">{post.title}</h3>{sourceLinks([post.projectId])}
      <details open={selectedItem === post.id} className="mt-4"><summary className="cursor-pointer folio-ui underline underline-offset-4">View caption</summary><p className="folio-body mt-3 whitespace-pre-wrap break-words">{post.caption || 'No caption saved.'}</p></details>
      <div className="mt-5 flex flex-wrap gap-4 folio-ui">{post.kind === 'carousel' && data.projects.find(item => item.id === post.projectId)?.canCreate && <Link className="underline underline-offset-4" href={`/designer/projects/${encodeURIComponent(post.projectId)}/instagram?export=${encodeURIComponent(post.id)}`}>Open carousel</Link>}{post.campaignId && <Link className="underline underline-offset-4" href={studioHref('campaigns', project || undefined, post.campaignId)}>View campaign</Link>}<Link className="text-folio-text-secondary underline underline-offset-4" href={`/project/${encodeURIComponent(post.projectId)}`}>View project</Link></div>
    </article>)}</div>;
  }

  function renderCampaigns(limit?: number) {
    const items = limit ? campaigns.slice(0, limit) : campaigns;
    if (!items.length) return <Empty title="Give a project more than one moment" text="Build a campaign from a published project, then find its sequence and captions here alongside your other work." />;
    return <div className="grid gap-4 md:grid-cols-2">{items.map(campaign => <article key={campaign.id} className={cardClass}>
      <div className="flex flex-wrap justify-between gap-2 folio-meta text-folio-text-secondary"><span>{label(campaign.preset)} campaign</span><span>{campaign.postCount} of {campaign.totalPosts} pieces saved</span></div>
      <h3 className="folio-h3 mt-3 break-words">{campaign.title}</h3>{sourceLinks([campaign.projectId])}
      <details open={selectedItem === campaign.id} className="mt-5"><summary className="cursor-pointer folio-ui underline underline-offset-4">View sequence & captions</summary><ol className="mt-4 space-y-4">{campaign.posts.map(post => <li key={post.id} className="border-l-2 border-folio-border-subtle pl-4"><h4 className="folio-ui">{post.sequenceNum}. {post.title || 'Campaign piece'}</h4><p className="folio-body mt-2 whitespace-pre-wrap break-words text-folio-text-secondary">{post.caption}</p></li>)}</ol><p className="folio-meta mt-4 text-folio-text-secondary">This is the saved generation record. Downloads from the original export are not stored here.</p></details>
      <Link href={`/project/${encodeURIComponent(campaign.projectId)}`} className="mt-5 inline-block folio-ui underline underline-offset-4">View project</Link>
    </article>)}</div>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl"><p className="folio-meta uppercase tracking-widest text-folio-text-secondary">{data.workspace.name} · Your publishing desk</p><h1 className="folio-h1 mt-3">Publishing Studio</h1><p className="folio-body mt-3 text-folio-text-secondary">The next story is already in your work. Bring your editorial ideas, social posts, and campaigns together.</p></div>
        <div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => navigate({ create: 'post' })}>Create a post</button><button className={`${buttonClass} bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]`} onClick={() => navigate({ create: 'campaign' })}>Build a campaign <ArrowUpRight className="h-4 w-4" /></button></div>
      </header>

      <nav aria-label="Publishing Studio views" className="mt-8 flex gap-1 overflow-x-auto border-b border-folio-border-subtle pb-3">{STUDIO_VIEWS.map(tab => <Link key={tab} aria-current={view === tab ? 'page' : undefined} href={studioHref(tab, project || undefined)} className={`shrink-0 rounded-full px-5 py-2 folio-ui ${view === tab ? 'bg-folio-text-primary text-white' : 'text-folio-text-secondary hover:bg-surface-ground'}`}>{label(tab)}</Link>)}</nav>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 folio-meta">Project<select className={fieldClass} value={project} onChange={event => navigate({ project: event.target.value, item: null })}><option value="">All projects</option><option value="studio-wide">Studio-wide</option>{data.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="flex min-w-0 flex-col gap-1 folio-meta">Search<input className={fieldClass} type="search" value={query} placeholder="Find a story or project" onChange={event => navigate({ q: event.target.value })} /></label>
        <label className="flex min-w-0 flex-col gap-1 folio-meta">Status<select className={fieldClass} value={status} disabled={!statuses.length} onChange={event => navigate({ status: event.target.value })}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value === 'in_progress' ? 'Shortlisted' : label(value)}</option>)}</select></label>
        <label className="flex min-w-0 flex-col gap-1 folio-meta">Sort<select className={fieldClass} value={sort} onChange={event => navigate({ sort: event.target.value })}><option value="recent">Recently updated</option><option value="project">Project A–Z</option><option value="attention">Needs attention</option></select></label>
      </div>
      {project && <div className="mt-4 flex flex-wrap items-center gap-4 folio-ui"><span className="rounded-full bg-surface-ground px-3 py-1">{selectedProject?.title || (project === 'studio-wide' ? 'Studio-wide' : 'Project unavailable in this workspace')}</span><button className="underline underline-offset-4" onClick={() => navigate({ project: null, item: null })}>All projects</button>{selectedProject && <Link className="text-folio-text-secondary underline underline-offset-4" href={`/project/${encodeURIComponent(project)}`}>Back to project</Link>}</div>}
      {data.truncated && <p role="status" className="mt-4 folio-meta">Showing a limited set of recent work. Older records may not appear in these results.</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-surface-ground p-4 folio-ui">{notice}</p>}
      {actionError && <p role="alert" className="mt-5 rounded-xl border border-folio-border-subtle p-4 folio-ui">{actionError}</p>}

      {creation && <section className={`${cardClass} mt-6`} aria-label={creation === 'campaign' ? 'Choose a project for your campaign' : 'Choose a project for your post'}>
        <div className="flex items-start justify-between gap-4"><div><h2 className="folio-h3">{creation === 'campaign' ? 'Start a project campaign' : 'Create a carousel'}</h2><p className="folio-body mt-2 text-folio-text-secondary">Choose a published project. You can work here without opening each project first.</p></div><button className="folio-ui underline" onClick={() => navigate({ create: null })}>Close</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{availableProjects.map(item => creation === 'campaign' ? <button key={item.id} className={`${buttonClass} justify-start text-left`} onClick={() => setCampaignProject(item.id)}>{item.title}<ArrowUpRight className="h-4 w-4 shrink-0" /></button> : <Link key={item.id} className={`${buttonClass} justify-start`} href={`/designer/projects/${encodeURIComponent(item.id)}/instagram`}>{item.title}<ArrowUpRight className="h-4 w-4 shrink-0" /></Link>)}</div>
        {!availableProjects.length && <p className="mt-4 folio-body">No eligible published projects in this selection. Choose All projects or publish a project you own to begin.</p>}
        <p className="folio-meta mt-5 text-folio-text-secondary">Campaigns for standalone editorial stories and combinations of projects are not available yet.</p>
      </section>}

      {(view === 'overview' || view === 'editorial') && <section className="mt-9"><h2 className="folio-h2 mb-3">{view === 'overview' ? 'Your published stories' : 'Your editorial stories'}</h2><p className="folio-body mb-5 text-folio-text-secondary">{view === 'overview' ? `${publishedStories.length} published ${publishedStories.length === 1 ? 'story' : 'stories'} in this selection. Start a campaign or carousel from your existing work. Social pieces appear here after you create them.` : 'Your existing project stories and the social work you can create from them.'}</p>{(view === 'overview' ? publishedStories : editorials).length ? <div className="grid gap-4 md:grid-cols-2">{(view === 'overview' ? publishedStories : editorials).map(story => <article key={story.id} className={cardClass}><div className="flex flex-wrap justify-between gap-2 folio-meta text-folio-text-secondary"><span>{formatLabel(story.format)}</span><span>{label(story.status)}</span></div><h3 className="folio-h3 mt-3">{story.title}</h3>{sourceLinks([story.projectId])}<div className="mt-5 flex flex-wrap gap-4 folio-ui"><Link href={story.status === 'published' ? `/p/${encodeURIComponent(story.slug)}` : `/project/${encodeURIComponent(story.projectId)}`} className="underline underline-offset-4">{story.status === 'published' ? 'View story' : 'Continue project story'}</Link>{data.projects.find(item => item.id === story.projectId)?.canCreateCampaign && <Link href={studioHref('campaigns', story.projectId) + '&create=campaign'} className="underline underline-offset-4">Create a campaign</Link>}{data.projects.find(item => item.id === story.projectId)?.canCreate && <Link href={`/designer/projects/${encodeURIComponent(story.projectId)}/instagram`} className="underline underline-offset-4">Create a carousel</Link>}</div></article>)}</div> : <Empty title="No editorial stories in this selection" text="Your project stories appear here alongside your proposed next stories." />}</section>}
      {(view === 'overview' || view === 'editorial') && <section className="mt-9"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--accent)]" /><h2 className="folio-h2">Suggested stories</h2></div><p className="folio-body mt-2 text-folio-text-secondary">Connections across your projects, with the source work behind each idea.</p></div><button className={buttonClass} disabled={pending !== null} onClick={discover}>{pending === 'discover' ? 'Reviewing your work…' : 'Find story ideas'}</button></div>{renderIdeas(view === 'overview' ? 2 : undefined)}{view === 'overview' && ideas.length > 2 && <Link href={studioHref('editorial', project || undefined)} className="mt-4 inline-block folio-ui underline">View all editorial ideas</Link>}</section>}

      {(view === 'overview' || view === 'posts') && <section className="mt-9"><div className="mb-5 flex items-center gap-2"><Newspaper className="h-5 w-5 text-[var(--accent)]" /><h2 className="folio-h2">{view === 'overview' ? 'Recent social pieces' : 'Social posts'}</h2></div>{renderPosts(view === 'overview' ? 2 : undefined)}{view === 'overview' && posts.length > 2 && <Link href={studioHref('posts', project || undefined)} className="mt-4 inline-block folio-ui underline">View all posts</Link>}</section>}
      {(view === 'overview' || view === 'campaigns') && <section className="mt-9"><div className="mb-5 flex items-center gap-2"><Layers3 className="h-5 w-5 text-[var(--accent)]" /><h2 className="folio-h2">Campaigns</h2></div>{renderCampaigns(view === 'overview' ? 2 : undefined)}{view === 'overview' && campaigns.length > 2 && <Link href={studioHref('campaigns', project || undefined)} className="mt-4 inline-block folio-ui underline">View all campaigns</Link>}</section>}
      {activeCampaign && <CampaignWizard projectId={activeCampaign.id} projectTitle={activeCampaign.title} onClose={() => { setCampaignProject(null); reload(); }} />}
    </main>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-dashed border-folio-border-subtle p-6 md:p-8"><h3 className="folio-h3">{title}</h3><p className="folio-body mt-2 max-w-2xl text-folio-text-secondary">{text}</p></div>;
}
