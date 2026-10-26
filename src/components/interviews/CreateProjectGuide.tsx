'use client';

import { workflowRequest } from '@/lib/client/workflowRequest';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { expertiseIntent } from '@/lib/publishing-studio/expertise-navigation';
import { COMPLETION_MONTHS, completionDateInputError } from '@/lib/projects/completionDate';
import { ProjectGuideUploads } from './ProjectGuideUploads';

/** Intake is actor-scoped. A project is created only when the designer submits real input. */
type CreateProjectGuideProps = { actorId: string; workspaceId: string; onManual: () => void };
export function CreateProjectGuide(props: CreateProjectGuideProps) {
  return <ProjectIntake key={`${props.actorId}.${props.workspaceId}`} {...props} />;
}
function ProjectIntake({ actorId, workspaceId, onManual }: CreateProjectGuideProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [creationStarted, setCreationStarted] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const storageKey = `folio.project-intake.v1.${actorId}.${workspaceId}`;
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  const project = useRef<string | null>(null);
  const creation = useRef<Promise<string> | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved.title === 'string' && typeof saved.year === 'string' && typeof saved.month === 'string') {
        setTitle(saved.title || ''); setYear(saved.year || ''); setMonth(saved.month || '');
        pending.current = saved.pending && typeof saved.pending.requestId === 'string' ? saved.pending : null;
        setCreationStarted(!!pending.current);
        project.current = typeof saved.createdId === 'string' ? saved.createdId : null; setCreatedId(project.current);
      }
    } catch { setStorageError(true); }
    setLoaded(true);
  }, [storageKey]);
  const persist = (values: { title: string; year: string; month: string }, id = project.current) => {
    try { const saved = JSON.stringify({ ...values, createdId: id, pending: pending.current }); sessionStorage.setItem(storageKey, saved); localStorage.setItem(storageKey, saved); setStorageError(false); }
    catch { setStorageError(true); }
  };
  const projectHref = (id: string) => {
    const next = new URLSearchParams({ view: 'media', step: 'rooms', action: 'sort-rooms' });
    if (search.has('expertiseTopic') || search.has('expertiseProjects')) { const intent = expertiseIntent(search.get('expertiseTopic'), search.get('expertiseProjects')); next.set('expertiseTopic', intent.topic); next.set('expertiseProjects', intent.projectIds.join(',')); }
    return `/project/${encodeURIComponent(id)}?${next}`;
  };
  const continueToProject = (id: string) => {
    try { sessionStorage.removeItem(storageKey); localStorage.removeItem(storageKey); }
    catch { /* Navigation must not turn confirmed persistence into a failure. */ }
    router.push(projectHref(id));
  };
  const manual = () => { if (project.current) continueToProject(project.current); else onManual(); };
  const ensureProject = async () => {
    if (project.current) return project.current;
    if (!title.trim()) throw new Error('Give the project a name before adding its photographs.');
    const dateError = completionDateInputError(year, month);
    if (dateError) throw new Error(dateError);
    if (!creation.current) creation.current = (async () => {
      if (!pending.current) pending.current = { requestId: crypto.randomUUID(), title: title.trim(), timeline: 'PAST', projectStatus: 'completed_project', projectType: 'UNSPECIFIED', completedYear: Number(year), completedMonth: month ? Number(month) : null, designerOrgId: workspaceId };
      setCreationStarted(true);
      persist({ title, year, month });
      const response = await workflowRequest('/api/projects', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.current) });
      const data = await response.json();
      if ([400, 403, 422].includes(response.status)) { pending.current = null; setCreationStarted(false); persist({ title, year, month }); }
      if (!response.ok || !data.id) throw new Error(data.error || 'The project could not be created. Your input is still here.');
      project.current = data.id; setCreatedId(data.id); persist({ title, year, month }, data.id); return data.id as string;
    })().catch(error => { creation.current = null; throw error; });
    return creation.current;
  };
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8" aria-label="Create a project with Folio">
    <header><h1 className="font-headline text-folio-h2">Add a completed project</h1><p className="mt-3 max-w-2xl text-folio-body text-text-secondary">Name your project, add when it was completed, and upload your photos.</p></header>
    <section className="space-y-4" aria-label="Project basics"><label className="block text-folio-meta">Project name<input aria-label="Project name" value={title} disabled={!loaded || !!createdId || creationStarted} onChange={event => { setTitle(event.target.value); persist({ title: event.target.value, year, month }); }} maxLength={80} placeholder="Name your project" className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body" /></label>
      <fieldset className="space-y-2" disabled={!loaded || !!createdId || creationStarted}>
        <legend className="text-folio-meta">When was it completed?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-folio-meta">Year
            <input aria-label="Completion year" type="number" inputMode="numeric" min={1800} max={new Date().getUTCFullYear()} required value={year} onChange={event => { setYear(event.target.value); persist({ title, year: event.target.value, month }); }} placeholder="e.g., 2024" className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body" />
          </label>
          <label className="block text-folio-meta">Month, if known
            <select aria-label="Completion month" value={month} onChange={event => { setMonth(event.target.value); persist({ title, year, month: event.target.value }); }} className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body">
              <option value="">Month unknown</option>
              {COMPLETION_MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </label>
        </div>
        <p className="text-folio-meta text-text-secondary">For older projects, the year alone is fine.</p>
      </fieldset>
      {createdId ? <p role="status" className="text-folio-meta">Your project is saved. Reselect any unconfirmed photographs to retry, or continue to review saved photos. Matching photos will not be added twice.</p> : null}
      {storageError ? <p role="alert" className="text-folio-meta">Changes could not be saved on this device. Keep this page open until your project is saved.</p> : null}
      {loaded ? <ProjectGuideUploads ensureProject={ensureProject} onAdded={(id, _photos, complete) => { if (complete) continueToProject(id) }} /> : null}
    </section>
    <button type="button" disabled={!loaded || (creationStarted && !createdId)} className="rounded-sm px-3 py-2 text-folio-ui underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-folio-gold" onClick={manual}>{createdId ? 'Continue to project' : 'Add project details first'}</button>
  </main>;
}
