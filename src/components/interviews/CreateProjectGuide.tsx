'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { expertiseIntent } from '@/lib/publishing-studio/expertise-navigation';
import { ProjectGuideUploads } from './ProjectGuideUploads';

/** Intake is actor-scoped. A project is created only when the designer submits real input. */
export function CreateProjectGuide({ workspaceId, onManual }: { actorId: string; workspaceId: string; onManual: () => void }) {
  const router = useRouter();
  const search = useSearchParams();
  const [title, setTitle] = useState('');
  const [timeline, setTimeline] = useState<'PAST' | 'PRESENT' | 'FUTURE'>('PAST');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const project = useRef<string | null>(null);
  const creation = useRef<Promise<string> | null>(null);
  const projectHref = (id: string) => {
    const next = new URLSearchParams({ view: 'media', step: timeline === 'FUTURE' ? 'references' : 'rooms' });
    if (timeline !== 'FUTURE') next.set('action', 'sort-rooms');
    if (search.has('expertiseTopic') || search.has('expertiseProjects')) { const intent = expertiseIntent(search.get('expertiseTopic'), search.get('expertiseProjects')); next.set('expertiseTopic', intent.topic); next.set('expertiseProjects', intent.projectIds.join(',')); }
    return `/project/${encodeURIComponent(id)}?${next}`;
  };
  const manual = () => { if (project.current) router.push(projectHref(project.current)); else onManual(); };
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
    <header><h1 className="font-headline text-folio-h2">Add a project</h1><p className="mt-3 max-w-2xl text-folio-body text-text-secondary">Give it a name and add your photos. You can fill in the details as you go.</p></header>
    <section className="space-y-4" aria-label="Project basics"><div className="grid gap-4 sm:grid-cols-2"><label className="text-folio-meta">Project name<input aria-label="Project name" value={title} disabled={!!createdId} onChange={event => setTitle(event.target.value)} maxLength={80} placeholder="Name your project" className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body" /></label><label className="text-folio-meta">Project stage<select aria-label="Project stage" value={timeline} disabled={!!createdId} onChange={event => setTimeline(event.target.value as typeof timeline)} className="mt-1 w-full rounded-sm border border-border bg-surface-ground px-3 py-2 text-folio-body"><option value="PAST">Completed project</option><option value="PRESENT">In progress</option><option value="FUTURE">Concept</option></select></label></div>
      <ProjectGuideUploads ensureProject={ensureProject} onAdded={(id, _photos, complete) => { if (complete) router.push(projectHref(id)); }} />
    </section>
    <button type="button" className="rounded-sm px-3 py-2 text-folio-ui underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-folio-gold" onClick={manual}>{createdId ? 'Continue to project' : 'Add project details first'}</button>
  </main>;
}
