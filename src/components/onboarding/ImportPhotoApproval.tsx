'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import forms from '@/components/ui/WorkflowForms.module.css';
type Photo = { id: string; url: string; name: string | null; inclusion: string };
type ReviewProject = { projectId: string; title: string; version: string; coverImageId: string | null; photos: Photo[] };
type Selection = ReviewProject & { selected: boolean; includedImageIds: string[] };
export function ImportPhotoApproval({ importId, onPublished }: { importId: string; onPublished: () => void }) {
  const [projects, setProjects] = useState<Selection[]>([]), [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [profileHref, setProfileHref] = useState(''), [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const [reviewedPortrait, setReviewedPortrait] = useState<string>();
  const [includePortrait, setIncludePortrait] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoaded(false); setError('');
    fetch(`/api/onboarding/workspace/${importId}/publish`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error); return data; })
      .then(data => { if (controller.signal.aborted) return; setProfileHref(data.profileHref); setReviewedPortrait(data.proposedPortrait);
        setProjects(data.projects.map((p: ReviewProject) => { const ids = p.photos.filter(photo => photo.inclusion !== 'EXCLUDED').map(photo => photo.id);
          return { ...p, selected: ids.length > 0, includedImageIds: ids, coverImageId: ids.includes(p.coverImageId || '') ? p.coverImageId : ids[0] || null }; })); setLoaded(true); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load photographs.'); });
    return () => controller.abort();
  }, [importId, revision]);
  const selected = projects.filter(p => p.selected && p.includedImageIds.length);
  function change(id: string, update: (p: Selection) => Selection) { setProjects(current => current.map(p => p.projectId === id ? update(p) : p)); }
  async function approve() {
    if (lock.current || !selected.length) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/onboarding/workspace/${importId}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedPortrait: includePortrait ? reviewedPortrait : undefined, projects: selected.map(({ projectId, title, version, coverImageId, includedImageIds }) => ({ projectId, title, version, coverImageId, includedImageIds })) }) });
      const data = await response.json(); if (!response.ok) throw Error(data.error);
      const published = new Set<string>(data.results.filter((r: { published: boolean }) => r.published).map((r: { projectId: string }) => r.projectId));
      setProjects(current => current.filter(p => !published.has(p.projectId)));
      setNotice(`${published.size} ${published.size === 1 ? 'project is' : 'projects are'} now visible on your Folio profile.`);
      const messages = [data.portraitError];
      if (data.results.some((r: { published: boolean }) => !r.published)) messages.push('Some projects need another review. Your successful approvals are live. Reload the remaining photographs before retrying.');
      setError(messages.filter(Boolean).join(' '));
      if (published.size) onPublished();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not confirm publication. Reload the review to check which projects are live.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={forms.section} aria-label="Publish imported photographs">
    <h2 className={forms.sectionTitle}>{loaded && !projects.length ? 'Publication status' : 'Choose what goes on your profile'}</h2>
    {(!loaded || projects.length > 0) && <p className={`${forms.lede} mb-5`}>Approve the selection together, or choose individual photographs below. You can add tags and tell each project&apos;s story later.</p>}
    {error && <p role="alert" className={forms.notice}>{error} <button className={forms.quiet} disabled={busy} onClick={() => setRevision(v => v + 1)}>Reload photographs</button></p>}
    {notice && <p role="status" className={forms.notice}>{notice} <Link className={forms.quiet} href={profileHref}>View my profile</Link></p>}
    {!loaded && !error && <p role="status">Preparing your photo selection.</p>}
    {loaded && projects.length > 0 && <>
      {reviewedPortrait && <label className={forms.label}><input type="checkbox" checked={includePortrait} disabled={busy} onChange={e => setIncludePortrait(e.target.checked)} /> Include the studio portrait on my cover</label>}
      <div className={forms.actions}><button className={forms.primary} disabled={busy || !selected.length} onClick={() => void approve()}>{busy ? 'Adding your photographs.' : `Add ${selected.length} ${selected.length === 1 ? 'project' : 'projects'} to my profile`}</button>
        <p className={forms.help}>{selected.reduce((sum, p) => sum + p.includedImageIds.length, 0)} photographs selected. This makes the selected projects and their details public.</p></div>
      <details className={forms.disclosure}><summary>Review projects and photographs</summary>
        <fieldset disabled={busy} className={forms.stack}>{projects.map(p => <section key={p.projectId}>
          <label className={forms.label}><span><input type="checkbox" checked={p.selected} onChange={e => change(p.projectId, v => ({ ...v, selected: e.target.checked }))} /> {p.title} · {p.includedImageIds.length} photographs</span></label>
          <details className={forms.disclosure}><summary>Choose photographs and cover for {p.title}</summary>
            <div className={forms.photoGrid}>{p.photos.map(photo => <div key={photo.id}>
              <label className={forms.photoOption}>
                {/* Approved storage URLs; private images use the existing authenticated transport. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.name || p.title} loading="lazy" />
                <input type="checkbox" aria-label={`Include ${photo.name || photo.id}`} checked={p.includedImageIds.includes(photo.id)} onChange={() => change(p.projectId, v => {
                  const ids = v.includedImageIds.includes(photo.id) ? v.includedImageIds.filter(id => id !== photo.id) : [...v.includedImageIds, photo.id];
                  return { ...v, includedImageIds: ids, coverImageId: ids.includes(v.coverImageId || '') ? v.coverImageId : ids[0] || null };
                })} />
              </label><label className={forms.help}><input type="radio" name={`cover-${p.projectId}`} checked={p.coverImageId === photo.id} disabled={busy || !p.includedImageIds.includes(photo.id)} onChange={() => change(p.projectId, v => ({ ...v, coverImageId: photo.id }))} /> Cover</label>
            </div>)}</div>
          </details>
        </section>)}</fieldset>
      </details>
    </>}
    {loaded && !projects.length && !notice && <p className={forms.help}>No unpublished imported photographs are waiting for approval. <Link className={forms.quiet} href={profileHref}>View my profile</Link></p>}
  </section>;
}
