'use client';

import { useRef, useState } from 'react';

type Candidate = { url: string; alt?: string };
export type GuidePhoto = { id: string; url: string; name?: string | null; room?: string | null; roomId?: string | null };
const button = 'rounded-sm border border-border px-4 py-2 text-folio-ui hover:bg-surface-ground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-folio-gold';

async function request(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || 'The upload could not be completed. Please try again.');
  return data;
}
function imageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('This photo could not be read.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file); });
}

/** Uses the existing authorized import/upload routes; intake creates a project only on an upload action. */
export function ProjectGuideUploads({ projectId, ensureProject, canImport = true, onAdded }: {
  projectId?: string; ensureProject?: () => Promise<string>; canImport?: boolean;
  onAdded: (projectId: string, photos: GuidePhoto[], complete: boolean) => void | Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [partialProject, setPartialProject] = useState<string | null>(null);
  const resolvedProject = useRef(projectId);
  const working = useRef(false);
  const resolveProject = async () => {
    if (!resolvedProject.current) resolvedProject.current = await ensureProject?.();
    if (!resolvedProject.current) throw new Error('Choose a project before adding photographs.');
    return resolvedProject.current;
  };
  const run = async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Upload unavailable. Please try again.'); }
    finally { working.current = false; setBusy(false); }
  };
  const upload = (files: File[]) => run(async () => {
    const photos = files.filter(file => file.type.startsWith('image/'));
    if (!photos.length) throw new Error('Choose image files to add photographs.');
    const id = await resolveProject(); const added: GuidePhoto[] = [];
    const failed: File[] = [];
    for (const file of photos) {
      try { const data = await request(`/api/projects/${encodeURIComponent(id)}/images`, { imageData: await imageData(file), mimeType: file.type, name: file.name }); added.push(data.image); }
      catch { failed.push(file); }
    }
    setFailedFiles(failed);
    if (failed.length && added.length) setPartialProject(id);
    if (added.length) await onAdded(id, added, !failed.length);
    if (failed.length) throw new Error(`${failed.length} ${failed.length === 1 ? 'photo could' : 'photos could'} not be uploaded. Your other photos are saved. Retry the files below or continue with the saved photos.`);
    setPartialProject(null);
  });
  const importUrl = () => run(async () => {
    const id = await resolveProject();
    const created = await request('/api/import/website', { projectId: id, url: url.trim() });
    const session = await request(`/api/import/${encodeURIComponent(created.sessionId)}`);
    if (session.status !== 'READY_FOR_REVIEW') throw new Error(session.errorMessage || 'No photos found. You can upload files below.');
    const found: Candidate[] = (session.processingMeta?.candidates || []).filter((item: Candidate) => typeof item.url === 'string');
    if (!found.length) throw new Error('No photos found. You can upload files below.');
    setCandidates(found); setSelected(found.map(item => item.url)); setImportId(created.sessionId);
  });
  const saveSelected = () => run(async () => {
    const id = await resolveProject(); const added: GuidePhoto[] = []; const failed: Candidate[] = [];
    for (const candidate of candidates.filter(item => selected.includes(item.url))) {
      try { const data = await request(`/api/projects/${encodeURIComponent(id)}/images`, { url: candidate.url, name: candidate.alt }); added.push(data.image); }
      catch { failed.push(candidate); }
    }
    setCandidates(failed); setSelected(failed.map(item => item.url));
    if (!failed.length && importId) await fetch(`/api/import/${encodeURIComponent(importId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }) });
    if (failed.length && added.length) setPartialProject(id);
    if (added.length) await onAdded(id, added, !failed.length);
    if (failed.length) throw new Error('Some photos could not be added. Your saved photos are safe; retry the remaining selection.');
    setPartialProject(null);
  });
  return <section className="space-y-4 rounded-lg border border-border bg-surface-canvas p-5" aria-label="Add project photographs">
    <div><h3 className="font-headline text-folio-h4">Add project photos</h3><p className="mt-1 text-folio-meta text-text-secondary">Import from a project link or upload files. Next, organize them into rooms.</p></div>
    {canImport ? <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void importUrl(); }}>
      <label className="min-w-0 flex-1 text-folio-meta">Project or portfolio link<input aria-label="Project or portfolio link" type="url" required value={url} onChange={event => setUrl(event.target.value)} disabled={busy} placeholder="https://…" className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body" /></label>
      <button className={`${button} self-end`} disabled={busy || !url.trim()}>{busy ? 'Working…' : 'Find photos'}</button>
    </form> : <p className="text-folio-meta text-text-secondary">Website import is available with Pro. Upload your photographs below.</p>}
    <label className={`${button} flex max-w-full cursor-pointer flex-wrap items-center gap-2`}>Upload photos<input aria-label="Upload project photos" type="file" accept="image/*" multiple disabled={busy} className="min-w-0 max-w-full text-folio-meta" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; if (files.length) void upload(files); }} /></label>
    {candidates.length ? <div className="space-y-3"><p className="text-folio-meta">Choose the photographs to add.</p><div className="grid max-h-64 grid-cols-3 gap-2 overflow-auto sm:grid-cols-5">{candidates.map(item => <label key={item.url} className="relative cursor-pointer"><img src={item.url} alt={item.alt || 'Imported photograph'} className="aspect-square w-full rounded-sm object-cover" /><input type="checkbox" aria-label={`Select ${item.alt || 'photograph'}`} checked={selected.includes(item.url)} disabled={busy} onChange={event => setSelected(current => event.target.checked ? [...current, item.url] : current.filter(url => url !== item.url))} className="absolute left-2 top-2 accent-folio-gold" /></label>)}</div><button type="button" className={button} disabled={busy || !selected.length} onClick={() => void saveSelected()}>Add selected photos</button></div> : null}
    {busy ? <p role="status" className="text-folio-meta">Adding your project photographs…</p> : null}
    {error ? <p role="alert" className="text-folio-meta">{error}</p> : null}
    {failedFiles.length ? <div className="space-y-2 text-folio-meta"><p>Still to upload: {failedFiles.map(file => file.name).join(', ')}</p><button type="button" className={button} disabled={busy} onClick={() => void upload(failedFiles)}>Retry failed photos</button></div> : null}
    {partialProject ? <button type="button" className={button} disabled={busy} onClick={() => void onAdded(partialProject, [], true)}>Continue with saved photos</button> : null}
  </section>;
}
