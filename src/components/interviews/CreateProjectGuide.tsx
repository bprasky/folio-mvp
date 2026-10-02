'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { expertiseIntent } from '@/lib/publishing-studio/expertise-navigation';
import { LiveInterviewPanel, type LivePanelControls, type LiveStartIntent } from './LiveInterviewPanel';
import { ProjectGuideUploads } from './ProjectGuideUploads';

/** Intake is actor-scoped. A project is created only when the designer submits real input. */
export function CreateProjectGuide({ actorId, workspaceId, onManual }: { actorId: string; workspaceId: string; onManual: () => void }) {
  const router = useRouter();
  const search = useSearchParams();
  const [title, setTitle] = useState('');
  const [timeline, setTimeline] = useState<'PAST' | 'PRESENT' | 'FUTURE'>('PAST');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const project = useRef<string | null>(null);
  const creation = useRef<Promise<string> | null>(null);
  const controls = useRef<LivePanelControls | null>(null);
  const intent = useRef<LiveStartIntent>({ requestId: crypto.randomUUID(), consumed: false });
  const onControlsReady = useCallback((next: LivePanelControls | null) => { controls.current = next; }, []);
  const projectHref = (id: string, manual = false) => {
    const next = new URLSearchParams({ view: 'media' });
    if (manual) next.set('manual', '1');
    if (search.has('expertiseTopic') || search.has('expertiseProjects')) { const intent = expertiseIntent(search.get('expertiseTopic'), search.get('expertiseProjects')); next.set('expertiseTopic', intent.topic); next.set('expertiseProjects', intent.projectIds.join(',')); }
    return `/project/${encodeURIComponent(id)}?${next}`;
  };
  const manual = async () => { await controls.current?.stop(); if (project.current) router.push(projectHref(project.current, true)); else onManual(); };
  const ensureProject = async () => {
    if (project.current) return project.current;
    if (!title.trim()) throw new Error('Give the project a name before adding its photographs.');
    if (!creation.current) creation.current = (async () => {
      const response = await fetch('/api/projects', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), timeline, projectStatus: timeline === 'FUTURE' ? 'new_project' : 'completed_project', projectType: 'UNSPECIFIED', designerOrgId: workspaceId }) });
      const data = await response.json(); if (!response.ok || !data.id) throw new Error(data.error || 'The project could not be created. Your input is still here.');
      project.current = data.id; setCreatedId(data.id); return data.id as string;
    })().catch(error => { creation.current = null; throw error; });
    return creation.current;
  };
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8" aria-label="Create a project with Folio">
    <header><p className="text-folio-meta uppercase tracking-widest text-text-secondary">Folio interviews</p><h1 className="mt-2 font-headline text-folio-h2">A conversation worth sharing</h1><p className="mt-3 max-w-2xl text-folio-body text-text-secondary">Bring your project photographs for a podcast-style conversation about the decisions, surprises and details behind your work. We’ll shape it into your project story.</p></header>
    {available !== false ? <LiveInterviewPanel source={{ kind: 'project_guide', id: `new:${actorId}` }} startIntent={intent.current} presentation="primary" onAvailabilityChange={enabled => { setAvailable(enabled); if (!enabled) onManual(); }} onControlsReady={onControlsReady} /> : null}
    {available === null ? <p role="status" className="text-folio-meta">Getting your Folio host ready…</p> : null}
    <section className="space-y-4" aria-label="Project basics"><div className="grid gap-4 sm:grid-cols-2"><label className="text-folio-meta">Project name<input aria-label="Project name" value={title} disabled={!!createdId} onChange={event => setTitle(event.target.value)} maxLength={80} placeholder="Name your project" className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body" /></label><label className="text-folio-meta">Project stage<select aria-label="Project stage" value={timeline} disabled={!!createdId} onChange={event => setTimeline(event.target.value as typeof timeline)} className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body"><option value="PAST">Completed project</option><option value="PRESENT">In progress</option><option value="FUTURE">Concept</option></select></label></div>
      <ProjectGuideUploads ensureProject={ensureProject} onAdded={async (id, _photos, complete) => { if (!complete) return; await controls.current?.stop(); router.push(projectHref(id)); }} />
      <p className="text-folio-meta text-text-secondary">Add a link or files, sort your photographs into rooms, and explore the story together. Product tags add context whenever you want to include them.</p>
    </section>
    <button type="button" className="rounded-sm px-3 py-2 text-folio-ui underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-folio-gold" onClick={() => void manual()}>Use the full project form and step-by-step workspace</button>
  </main>;
}
