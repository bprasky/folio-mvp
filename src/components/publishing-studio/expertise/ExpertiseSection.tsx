'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { StudioPitchCard, StudioPitchDialog } from '../StudioPitchCard';
import { ExpertiseEvidence } from './ExpertiseEvidence';
import type { ExpertiseListing } from './transport';
const action = 'folio-ui underline underline-offset-4 disabled:opacity-50';

export function ExpertiseSection({ saved = false }: { saved?: boolean }) {
  const params = useSearchParams(); const router = useRouter();
  const topic = params.get('expertiseTopic') || 'a meaningful comparison across your projects';
  const [selected, setSelected] = useState<string[]>(() => (params.get('expertiseProjects') || '').split(',').filter(Boolean));
  const [data, setData] = useState<ExpertiseListing | null>(null);
  const [error, setError] = useState('');
  const [dismissing, setDismissing] = useState<string | null>(null); const [dismissReason, setDismissReason] = useState('');
  const [examples, setExamples] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [choosing, setChoosing] = useState(true);
  const [setupOpen, setSetupOpen] = useState(Boolean(params.get('expertiseProjects')));
  const load = useCallback(async () => {
    setError('');
    try { const response = await fetch('/api/publishing-studio/expertise', { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not retrieve your project connections.'); setData(result); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not retrieve your project connections.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (data?.discovery.status !== 'processing') return; const timer = window.setTimeout(() => void load(), 5000); return () => window.clearTimeout(timer); }, [data?.discovery.status, data, load]);
  useEffect(() => {
    if (saved || !data?.opportunities.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      const opportunityIds = entries.filter(entry => entry.isIntersecting).map(entry => { observer.unobserve(entry.target); return (entry.target as HTMLElement).dataset.expertiseOpportunity; }).filter(Boolean);
      if (opportunityIds.length) void fetch('/api/publishing-studio/expertise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'impressions', opportunityIds }) }).catch(() => undefined);
    }, { threshold: 0.25 });
    document.querySelectorAll('[data-expertise-opportunity]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [data, saved]);
  async function update(body: Record<string, unknown>) {
    setPending(true); setError('');
    try { const response = await fetch('/api/publishing-studio/expertise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Your request could not be completed.'); if (body.action === 'dismiss') { setDismissing(null); setDismissReason(''); } if (body.action === 'compare' && result.id) router.push(`/designer/studio/expertise?id=${encodeURIComponent(result.id)}`); else await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your request could not be completed.'); }
    finally { setPending(false); }
  }
  if (data?.enabled === false) return null;
  const discovering = pending || data?.discovery.status === 'processing';
  const work = data?.work.filter(item => item.status !== 'archived') || [];
  if (saved && data && !work.length && !error) return null;
  const errorContent = error && <div role="alert"><p className="folio-body">{error} Your saved work remains available.</p><button className={`${action} mt-2`} onClick={() => void load()}>Try again</button></div>;
  return <section id={saved ? undefined : 'my-expertise'} aria-label={saved ? 'Your expertise articles' : 'My expertise'} className="space-y-5 border-t border-folio-border-subtle pt-8">
    <h2 className="folio-h2">{saved ? 'Your expertise articles' : 'My expertise'}</h2>
    {saved ? <>{errorContent}<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{work.map(item => <article key={item.id} className="rounded-xl border border-folio-border-subtle p-5"><p className="folio-meta">{item.sourceChanges.length ? 'Sources changed · review needed' : item.publishedUrl ? 'Published article' : item.article ? 'Ready to review' : 'Interview in progress'}</p><h3 className="folio-h3 mt-2">{item.article?.title || item.session.thesis}</h3><Link href={`/designer/studio/expertise?id=${encodeURIComponent(item.id)}`} className={`${action} mt-4 inline-block`}>{item.article ? 'Review article' : 'Continue interview'}</Link></article>)}</div></> : <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{data?.opportunities.slice(0, 3).map(item => <div key={item.id} data-expertise-opportunity={item.id}>
        <StudioPitchCard eyebrow="Expertise article" title={item.readerBenefit} image={<ExpertiseEvidence compact evidence={item.projectIds.map(id => item.evidence.find(evidence => evidence.projectId === id && evidence.imageUrl)).filter((evidence): evidence is NonNullable<typeof evidence> => Boolean(evidence))} />} actionLabel="Answer questions" href={`/designer/studio/expertise?opportunity=${encodeURIComponent(item.id)}`}>
          <p>{item.thesis}</p><p>Bring your perspective in a guided interview. Create an illustrated article for your profile.</p>{item.gaps.length > 0 && <p>{item.gaps[0]}</p>}
          <button disabled={pending} className={`${action} text-folio-text-secondary`} onClick={() => { setDismissing(item.id); setDismissReason(''); }}>Dismiss idea</button>
          {dismissing === item.id && <section aria-label="Dismiss this idea" className="space-y-3 rounded-xl border border-folio-border-subtle p-4"><label className="block folio-ui">What missed the mark? (Optional)<textarea className="mt-2 w-full rounded-lg border border-folio-border-subtle p-3 folio-body" maxLength={1000} value={dismissReason} onChange={event => setDismissReason(event.target.value)} /></label><p className="folio-meta">This idea will stay dismissed unless its evidence materially changes.</p><div className="flex gap-4"><button disabled={pending} className={action} onClick={() => void update({ action: 'dismiss', opportunityId: item.id, reason: dismissReason })}>Confirm dismissal</button><button disabled={pending} className={action} onClick={() => setDismissing(null)}>Keep idea</button></div></section>}
          {errorContent}
        </StudioPitchCard>
      </div>)}
      {!data?.opportunities.length && <button type="button" onClick={() => setSetupOpen(true)} className="min-h-52 rounded-2xl border border-folio-border-subtle bg-folio-surface-muted p-6 text-left transition hover:border-folio-text-secondary"><span className="folio-meta">Expertise article</span><span className="folio-h3 mt-3 block">Show how your thinking connects your projects.</span><span className="folio-ui mt-6 block">{data?.discovery.status === 'processing' ? 'Connections in progress →' : error || data?.discovery.status === 'error' ? 'Review connections →' : 'Explore an idea →'}</span></button>}
      </div>
      {!!data?.opportunities.length && <button className={action} onClick={() => setSetupOpen(true)}>Compare other projects</button>}
      {setupOpen && <StudioPitchDialog title="Find your next expertise article" onClose={() => setSetupOpen(false)}><div className="space-y-5">
        <p className="folio-body">Compare the decisions behind two projects, then turn your perspective into an illustrated article for your profile.</p>
        {errorContent}
        {!data && !error && <p role="status" className="folio-body">Loading your connections…</p>}
      {data?.discovery.status === 'processing' && <p role="status" className="folio-body">Your selected projects are being reviewed. Your saved work is available while Folio looks for connections.</p>}
      {data?.discovery.status === 'error' && <p role="alert" className="folio-body">{data.discovery.message || 'The comparison could not be retrieved. Try again; this does not mean your portfolio lacks evidence.'}</p>}
      {data && !['processing', 'error'].includes(data.discovery.status) && !data.opportunities.length && <p className="folio-body">{data.discovery.message || (data.projects.length < 2 ? 'Add another relevant project to explore how your approach changes between homes.' : data.discovery.status === 'not_started' ? 'Choose projects to look for a specific comparison worth sharing.' : 'No strong connection found in this selection yet. Try other projects or add more project detail.')}</p>}
      {params.get('expertiseTopic') && <p className="folio-meta">Explore: {topic}</p>}
      <div className="flex flex-wrap gap-5"><button disabled={pending} className={action} onClick={() => setChoosing(value => !value)}>Choose existing projects</button><Link className={action} href={`/designer/create?expertiseTopic=${encodeURIComponent(topic)}&expertiseProjects=${encodeURIComponent(selected.join(','))}`}>Add a project</Link><button disabled={discovering} className={action} onClick={() => void update({ action: 'discover', topic, ...(selected.length ? { projectIds: selected } : {}) })}>{discovering ? 'Looking for a meaningful connection…' : data?.discovery.status === 'error' ? 'Retry connections' : 'Find connections'}</button></div>
      {choosing && <fieldset className="rounded-xl border border-folio-border-subtle p-5"><legend className="folio-ui px-2">Projects to compare</legend><div className="flex flex-wrap gap-4">{data?.projects.map(project => <label key={project.id} className="flex items-center gap-2 folio-body"><input type="checkbox" checked={selected.includes(project.id)} onChange={event => setSelected(current => event.target.checked ? [...current, project.id] : current.filter(id => id !== project.id))} />{project.title}</label>)}</div><p className="folio-meta mt-4">Choose at least two relevant projects. Their evidence determines whether a useful comparison is available.</p>
        {!!data?.selectableEvidence?.length && <div className="mt-5"><h3 className="folio-h3">Or show us the exact examples</h3><p className="folio-body mt-2">Choose photographs from two projects and explain the connection yourself.</p><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.selectableEvidence.filter(item => !selected.length || selected.includes(item.projectId)).map(item => <label key={item.id} className="space-y-2"><img src={item.imageUrl} alt={item.alt || item.projectName} className="aspect-[4/3] w-full rounded-xl object-cover" /><span className="flex gap-2 folio-body"><input type="checkbox" checked={examples.includes(item.id)} onChange={event => setExamples(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{item.projectName} · {item.roomName}</span></label>)}</div><button disabled={pending || new Set(data.selectableEvidence.filter(item => examples.includes(item.id)).map(item => item.projectId)).size < 2} className={`${action} mt-4`} onClick={() => void update({ action: 'compare', evidenceIds: examples, topic })}>Start with these examples</button></div>}
      </fieldset>}
      </div></StudioPitchDialog>}
    </>}
  </section>;
}
