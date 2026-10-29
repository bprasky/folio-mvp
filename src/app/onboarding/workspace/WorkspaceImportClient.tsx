'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProfessionalSetupFrame } from '@/components/onboarding/ProfessionalSetupFrame';
import { SetupProgress } from '@/components/onboarding/SetupProgress';
import { WorkspaceReadyPreview } from '@/components/onboarding/WorkspaceReadyPreview';
import { hasUnfinishedItems, IMPORT_LIMITS, type ImportedProject, type ImportSection, type WorkspaceImport, type WorkspacePreviewProject } from '@/lib/workspace-import/types';

type Access = { id: string; name: string; website: string | null; canEditProfile: boolean; canImportProjects: boolean; canContribute: boolean };
type Review = { id: string; run: WorkspaceImport; canReview: boolean; access: Access;
  summary: { projects: number; photos: number; interviews: number; needsAttention: boolean };
  business: { description: string | null; location: string | null; logo: string | null; updatedAt: string }; bioVersion: string | null; bioText: string; projects: WorkspacePreviewProject[] };
type Props = { access: Access; memberships: Array<{ id: string; name: string }>; initialId?: string; available: boolean; returnTo: string;
  history: Array<{ id: string; date: string; phase: string }> };
const phaseLabels: Record<WorkspaceImport['phase'], string> = {
  discover: 'Finding the work on your website', profiles: 'Preparing your details and bio', projects: 'Saving your projects and photographs',
  notify: 'Your work is saved. Preparing your email', complete: 'Your import is ready to review', blocked: 'Your import needs attention',
};
const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function ProjectDrafts({ projects, canReview }: { projects: ImportedProject[]; canReview: boolean }) {
  if (!projects.length) return null;
  return <section className="space-y-4"><h2 className="folio-h3">Your projects</h2><p className="folio-meta text-folio-text-secondary">Saved privately for you to review, refine, and publish when you’re ready.</p>{projects.map(project => {
    const cover = project.photos.find(photo => photo.status === 'saved' && photo.savedUrl);
    const failed = project.photos.filter(photo => photo.status === 'failed').length;
    return <article key={project.url} className="rounded-xl border border-folio-border-subtle p-5 sm:p-6 space-y-4">
      {cover ? (
        // Protected project photos require the viewer's session; load them directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.savedUrl} alt={cover.alt || project.title} className="w-full h-48 object-cover rounded-lg" loading="lazy" />
      ) : null}
      <div className="flex justify-between gap-3"><h3 className="folio-ui">{project.title}</h3><span className="folio-meta text-folio-text-secondary">Private</span></div>
      <p className="folio-meta text-folio-text-secondary">{counted(project.photos.filter(photo => photo.status === 'saved').length, 'photograph')} saved · Add materials before your interview</p>
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    setDescription(review.run.profile.businessApplied ? review.business.description || '' : review.run.profile.description || review.business.description || '');
    setLocation(review.run.profile.businessApplied ? review.business.location || '' : review.run.profile.location || review.business.location || '');
    setBio(review.run.profile.bioApplied ? review.bioText : review.run.profile.bio || '');
    setUseLogo(!!review.run.profile.logo && !review.business.logo);
  }, [review]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    const body = { orgId: access.id, website, sections, consent, returnTo };
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
      else setNotice(body.action === 'business' ? 'Business profile updated.' : 'Bio context saved. Your background will guide your profile interview.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your changes.'); }
    finally { saving.current = false; setBusy(false); }
  }

  async function continueToFolio(destination = returnTo) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/user/workspace-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operatingAsOrgId: access.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not open your business workspace.');
      await updateSession(); router.push(destination); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open your workspace.'); }
    finally { saving.current = false; setBusy(false); }
  }

  const toggle = (section: ImportSection) => setSections(current => current.includes(section) ? current.filter(value => value !== section) : [...current, section]);
  const field = 'auth-field__input mt-2';
  const card = 'rounded-xl border border-folio-border-subtle p-5 sm:p-6 space-y-4';
  const run = review?.run;
  const showPreview = !!review?.canReview && !!(review.projects.length || run?.profile.description || run?.profile.logo || run?.profile.bio);
  return <ProfessionalSetupFrame stage="workspace" wide={showPreview}><div className="space-y-7">
    {showPreview && review && run ? <WorkspaceReadyPreview name={review.access.name} personName={run.personName} website={run.website}
      description={description} location={location} logo={useLogo ? run.profile.logo : review.business.logo} bio={bio} projects={review.projects} busy={busy} canContribute={review.access.canContribute}
      onReviewDetails={() => setDetailsOpen(true)} onOpenProject={(projectId, action) => void continueToFolio(`/project/${encodeURIComponent(projectId)}${action === 'open' ? '' : `?view=media&step=tags&action=${action === 'schedule' ? 'import-doc' : 'tag-by-hand'}`}`)} /> : <>
    <SetupProgress step={3} />
    <div><p className="folio-meta text-folio-text-secondary mb-2">{access.name}</p>
      <h1 className="folio-h2">{review?.canReview ? 'Your work, ready for you.' : id ? 'Your workspace is taking shape.' : 'Bring your work with you.'}</h1>
      <p className="folio-body text-folio-text-secondary mt-3">{id ? 'Your progress is saved here. You can leave this page and come back at any time.' : 'Start with your website. We’ll find your work and bring it into Folio, ready for you to make it your own.'}</p>
    </div></>}
    {error ? <p role="alert" className="auth-message auth-message--error">{error}</p> : null}
    {notice ? <p role="status" className="auth-message">{notice}</p> : null}
    {!id ? <>
      {memberships.length > 1 ? <label className="block folio-ui">Business<select className={field} value={access.id} onChange={event => router.push(`/onboarding/workspace?orgId=${encodeURIComponent(event.target.value)}&new=1&returnTo=${encodeURIComponent(returnTo)}`)}>{memberships.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label> : null}
      {!access.canContribute ? <p className="folio-body">Your business access is view only. Ask a business admin for permission to contribute.</p> : !available ? <p className="folio-body">Website imports aren’t available yet. You can add your business details and projects manually.</p> : <form onSubmit={start} className="space-y-6">
        <label className="block folio-ui">Business website<input className={field} type="text" inputMode="url" autoComplete="url" required maxLength={2048} value={website} onChange={event => setWebsite(event.target.value)} placeholder="yourstudio.com" /></label>
        <fieldset className="import-choices"><legend className="folio-ui">What would you like to bring over?</legend>
          {access.canEditProfile ? <label className="import-choice"><input type="checkbox" className="mt-1" checked={sections.includes('business')} onChange={() => toggle('business')} /><span><strong className="folio-ui">Your business</strong><span className="block folio-meta text-folio-text-secondary">Your logo, About text, and location.</span></span></label> : null}
          <label className="import-choice"><input type="checkbox" className="mt-1" checked={sections.includes('bio')} onChange={() => toggle('bio')} /><span><strong className="folio-ui">Your bio</strong><span className="block folio-meta text-folio-text-secondary">We’ll look for your background on the site, using your name.</span></span></label>
          {access.canImportProjects ? <label className="import-choice"><input type="checkbox" className="mt-1" checked={sections.includes('projects')} onChange={() => toggle('projects')} /><span><strong className="folio-ui">Your projects</strong><span className="block folio-meta text-folio-text-secondary">Photographs and descriptions, ready for you to add materials and build your sourcebook.</span></span></label> : null}
        </fieldset>
        <p className="import-assurance folio-meta text-folio-text-secondary">Nothing is published automatically. Review your details and keep your projects private until you choose to publish.</p>
        <label className="flex items-start gap-3 folio-meta"><input type="checkbox" className="mt-1" checked={consent} onChange={event => setConsent(event.target.checked)} required /><span>I’m authorized to use this content. Folio may read my website, privately save the selected text and images, and email me when it’s ready.</span></label>
        <button className="auth-submit" disabled={busy || !consent || !sections.length}>{busy ? 'Starting your import…' : 'Prepare my workspace'}</button>
        <p className="folio-meta text-folio-text-secondary import-footer">Leave it with us. We’ll email you when it’s ready to review.</p>
        <details className="folio-meta text-folio-text-secondary"><summary className="cursor-pointer underline underline-offset-4">What can Folio bring over?</summary><p className="mt-3">We’ll explore up to {IMPORT_LIMITS.pages} public pages and bring over up to {IMPORT_LIMITS.projects} projects with {IMPORT_LIMITS.photos} photographs each. If something can’t be read or is missing, you can add it later.</p></details>
      </form>}
    </> : !review ? <p role="status">Loading your saved progress…</p> : <>
      <details open={!showPreview} className="folio-meta"><summary className="cursor-pointer">Import progress and results</summary><section className={`${card} mt-3`} aria-label="Import progress"><div role="status" aria-live="polite"><h2 className="folio-ui">{phaseLabels[review.run.phase]}</h2><p className="folio-meta text-folio-text-secondary mt-2">{counted(review.run.pages.filter(page => page.status === 'saved').length, 'page')} read · {counted(review.summary.projects, 'project')} · {counted(review.summary.photos, 'photograph')} saved</p></div>
        <p className="folio-meta">{review.canReview ? 'Review the details below, then choose a project to continue.' : 'We’ll email you when preparation finishes. Your saved work stays available if part of the import needs attention.'}</p>
        {run?.notification.status === 'accepted' ? <p className="folio-meta text-folio-text-secondary">Your readiness email has been sent.</p> : run?.notification.error ? <p className="folio-meta">{run.notification.error}</p> : null}
      </section>
      {run ? <ProjectDrafts projects={run.projects} canReview={review.canReview} /> : null}
      </details>
      {run && run.notices.length > 0 ? <section className={card}><h2 className="folio-ui">A few things to review</h2><ul className="list-disc pl-5 space-y-2 folio-meta">{run.notices.map(message => <li key={message}>{message}</li>)}</ul></section> : null}
      {review.canReview && run ? <>
        {hasUnfinishedItems(run) && (run.retryCount || 0) < 3 ? <button type="button" className="auth-secondary" disabled={busy} onClick={() => apply({ action: 'retry' })}>Retry unfinished items</button> : null}
        {run.pages.some(page => page.status === 'failed') ? <section className={card}><h2 className="folio-ui">Pages we couldn’t read</h2><ul className="space-y-2 folio-meta">{run.pages.filter(page => page.status === 'failed').map(page => <li key={page.url} className="break-words"><a href={page.url} className="underline" target="_blank" rel="noreferrer">{page.url}</a><p>{page.error}</p></li>)}</ul></section> : null}
        <details id="profile-details" className="workspace-review-details" open={detailsOpen || !showPreview} onToggle={event => setDetailsOpen(event.currentTarget.open)}><summary>Review your profile details</summary><div className="workspace-review-details__body space-y-6">
        <p className="folio-meta text-folio-text-secondary">This is your private preview. Save business details when you’re happy with them; projects stay private until you publish each one.</p>
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
        </div></details>
      </> : null}
      {review.canReview ? <Link className="block underline folio-meta" href={`/onboarding/workspace?orgId=${access.id}&new=1&returnTo=${encodeURIComponent(returnTo)}`}>Bring over more work from a website</Link> : null}
    </>}
    <div className="border-t border-folio-border-subtle pt-6 space-y-3"><button type="button" disabled={busy} className="block underline folio-ui" onClick={() => void continueToFolio()}>{id ? 'Continue to Folio' : 'Set up manually for now'}</button><p className="folio-meta text-folio-text-secondary">You can return to website imports from your professional account.</p></div>
    {history.length > 0 ? <details><summary className="folio-meta cursor-pointer">Previous imports</summary><ul className="space-y-2 mt-3">{history.map(item => <li key={item.id}><Link className="folio-meta underline" href={`/onboarding/workspace?import=${item.id}`}>{new Date(item.date).toLocaleDateString()} — {item.phase === 'complete' ? 'Ready to review' : item.phase === 'blocked' ? 'Needs attention' : 'In progress'}</Link></li>)}</ul></details> : null}
  </div></ProfessionalSetupFrame>;
}
