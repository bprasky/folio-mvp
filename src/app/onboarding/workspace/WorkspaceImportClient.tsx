'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { hasUnfinishedItems, IMPORT_LIMITS, type ImportedProject, type ImportSection, type WorkspaceImport } from '@/lib/workspace-import/types';

type Access = { id: string; name: string; website: string | null; canEditProfile: boolean; canImportProjects: boolean; canContribute: boolean };
type Review = { id: string; run: WorkspaceImport; canReview: boolean; access: Access;
  summary: { projects: number; photos: number; interviews: number; needsAttention: boolean };
  business: { description: string | null; location: string | null; logo: string | null; updatedAt: string }; bioVersion: string | null };
type Props = { access: Access; memberships: Array<{ id: string; name: string }>; initialId?: string; available: boolean; returnTo: string;
  history: Array<{ id: string; date: string; phase: string }> };
const phaseLabels: Record<WorkspaceImport['phase'], string> = {
  discover: 'Reading your selected website pages', profiles: 'Preparing your details and bio', projects: 'Saving projects and preparing opening questions',
  notify: 'Your drafts are saved. Preparing your email', complete: 'Your import is ready to review', blocked: 'Your import needs attention',
};
const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function ProjectDrafts({ projects, canReview }: { projects: ImportedProject[]; canReview: boolean }) {
  if (!projects.length) return null;
  return <section className="space-y-4"><h2 className="folio-h3">Your private project drafts</h2>{projects.map(project => {
    const cover = project.photos.find(photo => photo.status === 'saved' && photo.savedUrl);
    const failed = project.photos.filter(photo => photo.status === 'failed').length;
    return <article key={project.url} className="rounded-xl border border-folio-border-subtle p-5 sm:p-6 space-y-4">
      {cover ? (
        // Protected project photos require the viewer's session; load them directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.savedUrl} alt={cover.alt || project.title} className="w-full h-48 object-cover rounded-lg" loading="lazy" />
      ) : null}
      <div className="flex justify-between gap-3"><h3 className="folio-ui">{project.title}</h3><span className="folio-meta text-folio-text-secondary">Private draft</span></div>
      <p className="folio-meta text-folio-text-secondary">{counted(project.photos.filter(photo => photo.status === 'saved').length, 'photograph')} saved{project.preparation ? ' · Opening questions prepared' : ''}</p>
      {project.error ? <p className="folio-meta">{project.error}</p> : null}
      {failed ? <p className="folio-meta">{counted(failed, 'photograph')} could not be imported. Retry, or upload them in the project.</p> : null}
      {project.projectId && canReview ? <Link href={`/project/${project.projectId}`} className="underline folio-ui">Review project</Link> : <p className="folio-meta">{project.status === 'failed' ? 'Retry this import to finish saving the project.' : 'Preparing this project…'}</p>}
    </article>;
  })}</section>;
}

export function WorkspaceImportClient({ access, memberships, initialId, available, returnTo, history }: Props) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [id, setId] = useState(initialId);
  const [review, setReview] = useState<Review | null>(null);
  const [website, setWebsite] = useState(access.website || '');
  const [bioUrl, setBioUrl] = useState('');
  const [projectLinks, setProjectLinks] = useState('');
  const [sections, setSections] = useState<ImportSection[]>([...(access.canEditProfile ? ['business' as const] : []), 'bio', ...(access.canImportProjects ? ['projects' as const] : [])]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const requestId = useRef<string>();
  const requestBody = useRef<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [useLogo, setUseLogo] = useState(false);
  const initialized = useRef<string>();

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch(`/api/onboarding/workspace/${id}`, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load your import.');
        if (controller.signal.aborted) return;
        setReview(data); setError('');
        if (!data.canReview) timer = setTimeout(load, 6000);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load your import.');
        timer = setTimeout(load, 15000);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, refresh]);

  useEffect(() => {
    if (!review?.canReview || initialized.current === review.id) return;
    initialized.current = review.id;
    setDescription(review.run.profile.description || review.business.description || '');
    setLocation(review.run.profile.location || review.business.location || '');
    setBio(review.run.profile.bio || '');
    setUseLogo(!!review.run.profile.logo && !review.business.logo);
  }, [review]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    const body = { orgId: access.id, website, sections, consent, returnTo,
      ...(sections.includes('bio') && bioUrl.trim() ? { bioUrl } : {}),
      ...(sections.includes('projects') ? { projectUrls: projectLinks.split('\n').map(value => value.trim()).filter(Boolean) } : {}) };
    const serialized = JSON.stringify(body);
    if (requestBody.current !== serialized) { requestBody.current = serialized; requestId.current = crypto.randomUUID(); }
    try {
      const response = await fetch('/api/onboarding/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, requestId: requestId.current }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start your import.');
      setId(data.id); router.replace(`/onboarding/workspace?import=${encodeURIComponent(data.id)}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start your import.'); }
    finally { saving.current = false; setBusy(false); }
  }

  async function apply(body: Record<string, unknown>) {
    if (saving.current || !id) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/onboarding/workspace/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your changes.');
      setReview(data);
      if (body.action === 'retry') { initialized.current = undefined; setRefresh(value => value + 1); }
      else setNotice(body.action === 'business' ? 'Business profile updated.' : 'Bio context saved. Your prepared questions will be available in your profile interview.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your changes.'); }
    finally { saving.current = false; setBusy(false); }
  }

  async function continueToFolio() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/user/workspace-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operatingAsOrgId: access.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open your business workspace.');
      await updateSession(); router.push(returnTo); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open your workspace.'); }
    finally { saving.current = false; setBusy(false); }
  }

  const toggle = (section: ImportSection) => setSections(current => current.includes(section) ? current.filter(value => value !== section) : [...current, section]);
  const field = 'auth-field__input mt-2';
  const card = 'rounded-xl border border-folio-border-subtle p-5 sm:p-6 space-y-4';
  const run = review?.run;
  return <div className="space-y-7">
    <div><p className="folio-meta text-folio-text-secondary mb-2">{access.name}</p>
      <h1 className="folio-h2">{review?.canReview ? 'Your work, ready for you.' : id ? 'Your workspace is taking shape.' : 'Bring your work with you.'}</h1>
      <p className="folio-body text-folio-text-secondary mt-3">{id ? 'Your progress is saved here. You can leave this page and come back at any time.' : 'Give us your website and choose what to bring over. We’ll prepare the first draft of your workspace, so you can start with your work already here.'}</p>
    </div>
    {error ? <p role="alert" className="auth-message auth-message--error">{error}</p> : null}
    {notice ? <p role="status" className="auth-message">{notice}</p> : null}
    {!id ? <>
      {memberships.length > 1 ? <label className="block folio-ui">Business<select className={field} value={access.id} onChange={event => router.push(`/onboarding/workspace?orgId=${encodeURIComponent(event.target.value)}&new=1&returnTo=${encodeURIComponent(returnTo)}`)}>{memberships.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label> : null}
      {!access.canContribute ? <p className="folio-body">Your business access is view only. Ask a business admin for permission to contribute.</p> : !available ? <p className="folio-body">Website imports aren’t available yet. You can add your business details and projects manually.</p> : <form onSubmit={start} className="space-y-6">
        <label className="block folio-ui">Business website<input className={field} type="text" inputMode="url" autoComplete="url" required maxLength={2048} value={website} onChange={event => setWebsite(event.target.value)} placeholder="yourstudio.com" /></label>
        <fieldset className={card}><legend className="folio-ui px-2">What would you like us to prepare?</legend>
          {access.canEditProfile ? <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={sections.includes('business')} onChange={() => toggle('business')} /><span><strong className="folio-ui">Business profile</strong><span className="block folio-meta text-folio-text-secondary">Logo, About text, and location. You’ll review these before applying them.</span></span></label> : null}
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={sections.includes('bio')} onChange={() => toggle('bio')} /><span><strong className="folio-ui">My personal bio</strong><span className="block folio-meta text-folio-text-secondary">Your own background and a head start on your profile interview.</span></span></label>
          {sections.includes('bio') ? <label className="block folio-meta">Link to your personal bio page (optional)<input className={field} type="text" inputMode="url" maxLength={2048} value={bioUrl} onChange={event => setBioUrl(event.target.value)} placeholder="yourstudio.com/team/your-name" /><span className="block text-folio-text-secondary mt-2">Use your own page. Without a link, we’ll look for a bio that matches your account name.</span></label> : null}
          {access.canImportProjects ? <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={sections.includes('projects')} onChange={() => toggle('projects')} /><span><strong className="folio-ui">Project drafts</strong><span className="block folio-meta text-folio-text-secondary">Separate projects with descriptions, photographs, and opening interview questions. Everything stays private.</span></span></label> : null}
          {sections.includes('projects') ? <details><summary className="folio-meta cursor-pointer underline">Add specific project links (optional)</summary><label className="block folio-meta mt-3">One page link per line<textarea rows={4} className={field} value={projectLinks} onChange={event => setProjectLinks(event.target.value)} placeholder="yourstudio.com/projects/harbor-house" /></label></details> : null}
        </fieldset>
        <p className="folio-meta text-folio-text-secondary">We’ll read up to {IMPORT_LIMITS.pages} public pages and import up to {IMPORT_LIMITS.projects} projects with {IMPORT_LIMITS.photos} photographs each. Some websites may need direct page links or a manual upload.</p>
        <label className="flex items-start gap-3 folio-meta"><input type="checkbox" className="mt-1" checked={consent} onChange={event => setConsent(event.target.checked)} required /><span>I’m authorized to use this website’s content. I give Folio permission to read the selected sections, copy their text and images into private drafts, and use them to prepare interview questions. Email me when they’re ready to review.</span></label>
        <button className="auth-submit" disabled={busy || !consent || !sections.length}>{busy ? 'Starting your import…' : 'Prepare my workspace'}</button>
        <p className="folio-meta text-folio-text-secondary">This runs in the background. No need to keep your browser open.</p>
      </form>}
    </> : !review ? <p role="status">Loading your saved progress…</p> : <>
      <section className={card} aria-label="Import progress"><div role="status" aria-live="polite"><h2 className="folio-ui">{phaseLabels[review.run.phase]}</h2><p className="folio-meta text-folio-text-secondary mt-2">{counted(review.run.pages.filter(page => page.status === 'saved').length, 'page')} read · {counted(review.summary.projects, 'project draft')} · {counted(review.summary.photos, 'photograph')} saved · {counted(review.summary.interviews, 'interview')} prepared</p></div>
        <p className="folio-meta">{review.canReview ? 'Review the details below, then choose a project to continue.' : 'We’ll email you when preparation finishes. Your saved work stays available if part of the import needs attention.'}</p>
        {run?.notification.status === 'accepted' ? <p className="folio-meta text-folio-text-secondary">Your readiness email has been sent.</p> : run?.notification.error ? <p className="folio-meta">{run.notification.error}</p> : null}
      </section>
      {run ? <ProjectDrafts projects={run.projects} canReview={review.canReview} /> : null}
      {run && run.notices.length > 0 ? <section className={card}><h2 className="folio-ui">A few things to review</h2><ul className="list-disc pl-5 space-y-2 folio-meta">{run.notices.map(message => <li key={message}>{message}</li>)}</ul></section> : null}
      {review.canReview && run ? <>
        {hasUnfinishedItems(run) && (run.retryCount || 0) < 3 ? <button type="button" className="auth-secondary" disabled={busy} onClick={() => apply({ action: 'retry' })}>Retry unfinished items</button> : null}
        {run.pages.some(page => page.status === 'failed') ? <section className={card}><h2 className="folio-ui">Pages we couldn’t read</h2><ul className="space-y-2 folio-meta">{run.pages.filter(page => page.status === 'failed').map(page => <li key={page.url} className="break-words"><a href={page.url} className="underline" target="_blank" rel="noreferrer">{page.url}</a><p>{page.error}</p></li>)}</ul></section> : null}
        {run.sections.includes('business') && review.access.canEditProfile ? <section className={card}><h2 className="folio-h3">Review your business details</h2>
          <p className="folio-meta text-folio-text-secondary">Saving updates your business’s public profile. Your existing details remain until you save.</p>
          {run.profile.sourceUrl ? <a href={run.profile.sourceUrl} target="_blank" rel="noreferrer" className="folio-meta underline">View source page</a> : null}
          {review.business.description ? <details><summary className="folio-meta cursor-pointer">Current About text</summary><p className="folio-body mt-2 whitespace-pre-wrap">{review.business.description}</p></details> : null}
          <label className="block folio-ui">About your business<textarea className={field} rows={6} maxLength={4000} value={description} onChange={event => setDescription(event.target.value)} /></label>
          <label className="block folio-ui">Location<input className={field} maxLength={120} value={location} onChange={event => setLocation(event.target.value)} /></label>
          {run.profile.logo ? <label className="flex items-center gap-3"><input type="checkbox" checked={useLogo} onChange={event => setUseLogo(event.target.checked)} />{/* Sanitized PNG copied by the import worker, never an external tracking image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={run.profile.logo} width={64} height={64} className="object-contain" alt="Imported business logo" /><span className="folio-meta">Use this logo{review.business.logo ? ' in place of the current logo' : ''}</span></label> : null}
          <button className="auth-secondary" disabled={busy} onClick={() => apply({ action: 'business', version: review.business.updatedAt, description, location, useLogo })}>{run.profile.businessApplied ? 'Save updated details' : 'Save to business profile'}</button>
        </section> : null}
        {run.sections.includes('bio') && run.profile.bio ? <section className={card}><h2 className="folio-h3">Your bio, ready for a conversation</h2><p className="folio-meta text-folio-text-secondary">Review your background below. This becomes context for your profile interview; your published bio and existing answers stay as they are.</p>
          <label className="block folio-ui">Your background<textarea className={field} rows={6} maxLength={4000} value={bio} onChange={event => setBio(event.target.value)} /></label>
          <button className="auth-secondary" disabled={busy || !bio.trim()} onClick={() => apply({ action: 'bio', version: review.bioVersion, bio })}>Use as interview context</button>
          {run.profile.bioApplied ? <Link href="/designer/profile" className="block underline folio-meta">Continue to my profile interview</Link> : null}
        </section> : null}
      </> : null}
      {review.canReview ? <Link className="block underline folio-meta" href={`/onboarding/workspace?orgId=${access.id}&new=1&returnTo=${encodeURIComponent(returnTo)}`}>Import another website or add missing page links</Link> : null}
    </>}
    <div className="border-t border-folio-border-subtle pt-6 space-y-3"><button type="button" disabled={busy} className="block underline folio-ui" onClick={continueToFolio}>{id ? 'Continue to Folio' : 'Set up manually for now'}</button><p className="folio-meta text-folio-text-secondary">You can return to website imports from your professional account.</p></div>
    {history.length > 0 ? <details><summary className="folio-meta cursor-pointer">Previous imports</summary><ul className="space-y-2 mt-3">{history.map(item => <li key={item.id}><Link className="folio-meta underline" href={`/onboarding/workspace?import=${item.id}`}>{new Date(item.date).toLocaleDateString()} — {item.phase === 'complete' ? 'Ready to review' : item.phase === 'blocked' ? 'Needs attention' : 'In progress'}</Link></li>)}</ul></details> : null}
  </div>;
}
