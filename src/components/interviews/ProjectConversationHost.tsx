'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { LiveAdapterSnapshot, ProjectGuideMetadata } from '@/lib/live-interview/adapter-types';
import { LiveInterviewPanel, type LivePanelControls, type LiveStartIntent } from './LiveInterviewPanel';
import { ProjectGuideUploads, type GuidePhoto } from './ProjectGuideUploads';
import { InterviewModal } from '@/components/posting/interview/InterviewModal';

const GuideContext = createContext<{ managed: boolean; manual: boolean; revision: number; open: () => void; restartId?: string; clearRestart: () => void; restart: () => Promise<void> } | null>(null);
export const useProjectConversation = () => useContext(GuideContext);
const button = 'rounded-sm border border-border px-4 py-2 text-folio-ui hover:bg-surface-ground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-folio-gold';

/** This boundary stays at the same page position across upload, room, tag and Story refreshes. */
export function ProjectConversationHost({ projectId, projectName, actorId, activeView, isEmpty, canImport, images, refreshKey, children, initiallyManual = false, canHost = true }: {
  projectId: string; projectName: string; actorId: string; activeView: string; isEmpty: boolean;
  canImport: boolean; images: GuidePhoto[]; refreshKey: string; children: ReactNode; initiallyManual?: boolean; canHost?: boolean;
}) {
  const router = useRouter();
  const eligible = canHost && (['media', 'story'].includes(activeView) || (isEmpty && !['publish', 'actions', 'boards'].includes(activeView)));
  const [manual, setManual] = useState(initiallyManual);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [guide, setGuide] = useState<ProjectGuideMetadata | null>(null);
  const [revision, setRevision] = useState(0);
  const [localPhotos, setLocalPhotos] = useState<GuidePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [restartId, setRestartId] = useState<string>();
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [connection, setConnection] = useState(0);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [question, setQuestion] = useState<LiveAdapterSnapshot['currentQuestion']>(null);
  const [photoMessage, setPhotoMessage] = useState('');
  const [uploadsOpen, setUploadsOpen] = useState(isEmpty);
  const intent = useRef<LiveStartIntent>({ requestId: crypto.randomUUID(), consumed: false });
  const controls = useRef<LivePanelControls | null>(null);
  const seenAction = useRef('');
  const resetReceipt = useRef<Record<string, unknown> | null>(null);
  const managed = eligible && !manual && available !== false;
  const toolsAlongside = managed && activeView === 'media' && !isEmpty;
  const shownPhotos = [...images, ...localPhotos.filter(photo => !images.some(saved => saved.id === photo.id))];
  const photo = shownPhotos[photoIndex % Math.max(1, shownPhotos.length)];
  useEffect(() => {
    setPhotoMessage('');
    const index = images.findIndex(image => question?.sourceImageIds.includes(image.id));
    if (index >= 0) setPhotoIndex(index);
  }, [question?.id, images]);
  const onControlsReady = useCallback((next: LivePanelControls | null) => { controls.current = next; }, []);
  const open = useCallback(() => { setManual(false); setAvailable(null); intent.current = { requestId: crypto.randomUUID(), consumed: false }; }, []);
  const fallback = async () => { await controls.current?.stop(); setManual(true); setError(''); };
  const onSnapshot = useCallback((snapshot?: Omit<LiveAdapterSnapshot, 'state'>) => {
    if (!snapshot?.guide) return;
    const next = snapshot.guide; setGuide(next); setQuestion(snapshot.currentQuestion); setRevision(value => value + 1);
    if (!next.actionId || seenAction.current === next.actionId || next.action === 'none') return;
    seenAction.current = next.actionId;
    if (next.action === 'resume_interview' && next.legacyInterview) { void controls.current?.stop().then(() => { setManual(true); setLegacyOpen(true); }); return; }
    if (next.action === 'start_over') { setRestartId(next.actionId); router.replace(`/project/${encodeURIComponent(projectId)}?view=story`, { scroll: false }); }
    else if (next.action === 'open_tagging') router.replace(`/project/${encodeURIComponent(projectId)}?view=media&step=tags&action=tag`, { scroll: false });
    else if (next.action === 'open_upload') { setUploadsOpen(true); document.getElementById(`guide-uploads-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [projectId, router]);
  const previousEligible = useRef(eligible);
  useEffect(() => {
    if (!eligible) void controls.current?.stop();
    else if (!previousEligible.current && !manual) { intent.current = { requestId: crypto.randomUUID(), consumed: false }; setConnection(value => value + 1); }
    previousEligible.current = eligible;
  }, [eligible, manual]);
  const restart = async () => {
    if (resetting) return;
    setResetting(true); setError('');
    try {
      await controls.current?.stop();
      const endpoint = `/api/posting/project/${encodeURIComponent(projectId)}/interview/reset`;
      if (!resetReceipt.current) {
        const response = await fetch(endpoint, { cache: 'no-store' }); const data = await response.json();
        if (!response.ok || !data.snapshot) throw new Error(data.message || 'Unable to check your saved interview.');
        resetReceipt.current = { ...data.snapshot, requestId: crypto.randomUUID() };
      }
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resetReceipt.current) });
      const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.message || 'The interview could not be restarted. Your saved work is retained.');
      for (const key of [`folio.guided.draft.${actorId}.${projectId}`, `interviewDraft:${projectId}`, `interview-draft-${projectId}`]) {
        try { const saved = JSON.parse(localStorage.getItem(key) || 'null'); if (saved?.sessionId !== data.session?.id && saved?.resetId !== data.resetId) localStorage.removeItem(key); } catch { /* server reset identity rejects stale drafts */ }
      }
      resetReceipt.current = null; setRestartId(undefined); setRevision(value => value + 1);
      // End/start is deliberate after the destructive reset, never a hidden replay.
      intent.current = { requestId: crypto.randomUUID(), consumed: false }; setConnection(value => value + 1); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please retry restarting your interview.'); }
    finally { setResetting(false); }
  };
  return <GuideContext.Provider value={{ managed, manual, revision, open, restartId, clearRestart: () => setRestartId(undefined), restart }}>
    <div className={toolsAlongside ? 'mx-auto max-w-[1600px] lg:grid items-start gap-4 lg:grid-cols-[minmax(320px,35%)_minmax(0,1fr)]' : ''}>
    {eligible ? <section className={`mx-auto w-full min-w-0 max-w-[1280px] space-y-5 px-4 py-6 ${toolsAlongside ? 'lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto' : 'md:px-10'}`} aria-label="Folio project conversation">
      {managed ? <>
        <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-folio-meta uppercase tracking-widest text-text-secondary">Folio interviews</p><h1 className="mt-2 font-headline text-folio-h2">The story behind your work</h1><p className="mt-2 max-w-2xl text-folio-body text-text-secondary">A podcast-style conversation about the decisions, surprises and details behind {projectName}. We’ll shape it into your project story.</p></div><button type="button" className={button} onClick={() => void fallback()}>Use the step-by-step workspace</button></header>
        <nav className="flex flex-wrap gap-2" aria-label="Conversation workspace"><button type="button" className={button} aria-current={activeView === 'media' ? 'page' : undefined} onClick={() => router.replace(`/project/${encodeURIComponent(projectId)}?view=media`, { scroll: false })}>Photos & details</button><button type="button" className={button} aria-current={activeView === 'story' ? 'page' : undefined} onClick={() => router.replace(`/project/${encodeURIComponent(projectId)}?view=story`, { scroll: false })}>Interview</button></nav>
        <div className={photo && !toolsAlongside ? 'grid items-start gap-5 lg:grid-cols-2' : 'mx-auto max-w-3xl'}>
          <LiveInterviewPanel key={connection} source={{ kind: 'project_guide', id: projectId }} startIntent={intent.current} presentation="primary" onCanonicalChange={onSnapshot} onAvailabilityChange={setAvailable} onControlsReady={onControlsReady} guideRefreshKey={`${refreshKey}:${localPhotos.map(item => item.id).join(',')}`} />
          {photo ? <section aria-label="Project photographs" className={toolsAlongside ? 'hidden' : 'space-y-3'}><img src={photo.url} alt={photo.name || projectName} className="max-h-[65dvh] w-full rounded-lg bg-surface-ground object-contain" /><div className="flex items-center justify-between gap-3"><button type="button" className={button} disabled={shownPhotos.length < 2} onClick={() => setPhotoIndex(value => (value + shownPhotos.length - 1) % shownPhotos.length)}>Previous photo</button><p className="text-folio-meta">{(photoIndex % shownPhotos.length) + 1} of {shownPhotos.length}{photo.room ? ` · ${photo.room}` : ''}</p><button type="button" className={button} disabled={shownPhotos.length < 2} onClick={() => setPhotoIndex(value => (value + 1) % shownPhotos.length)}>Next photo</button></div><p className="text-folio-meta text-text-secondary">Browse the photographs as you talk. The conversation follows the project’s saved context.</p></section> : null}
        </div>
        {guide?.phase === 'interview' && photo && question && !toolsAlongside ? <div className="flex flex-wrap items-center gap-3"><button type="button" className={button} disabled={!!question.roomId && photo.roomId !== question.roomId} onClick={() => { void controls.current?.linkPhoto(photo.id, question.id).then(ok => setPhotoMessage(ok ? 'This photograph is linked to your current answer.' : 'Wait for the current reply to save before linking this photograph.')); }}>Discuss this photo</button><p role="status" className="text-folio-meta text-text-secondary">{photoMessage || 'Browsing does not attach a photograph to your answer. Choose a photo from the current room to discuss it.'}</p></div> : null}
        {available === null ? <p role="status" className="text-folio-meta">Getting your Folio host ready…</p> : null}
        {guide && guide.photoCount > 0 ? <p className="text-folio-meta text-text-secondary">{guide.photoCount} photographs · {guide.taggedPhotoCount} photos with product context. Tags add useful detail; you can begin the conversation whenever you’re ready.</p> : null}
        <details id={`guide-uploads-${projectId}`} open={uploadsOpen} onToggle={event => setUploadsOpen(event.currentTarget.open)}><summary className="cursor-pointer py-2 text-folio-ui">Add photographs or a project link</summary><ProjectGuideUploads projectId={projectId} canImport={canImport} onAdded={(_id, added) => { setLocalPhotos(current => [...current, ...added]); router.refresh(); }} /></details>
      </> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-folio-meta text-text-secondary">{available === false ? 'Your project workspace is ready. Live hosting is not available for this account right now.' : 'Continue with photographs, rooms and your saved interview below.'}</p>{available !== false ? <button type="button" className={button} onClick={open}>Return to the conversation</button> : null}</div>}
      {error ? <div role="alert" className="space-y-2 text-folio-meta"><p>{error}</p><button type="button" className={button} disabled={resetting} onClick={() => void restart()}>Retry restart</button></div> : null}
    </section> : null}
    <div className="min-w-0" hidden={managed && isEmpty}>{children}</div>
    </div>
    {legacyOpen ? <InterviewModal open projectId={projectId} projectName={projectName} images={images.map(image => ({ ...image, name: image.name || undefined }))} initialIntent="resume" preferLegacy disableLive onOpenChange={setLegacyOpen} /> : null}
  </GuideContext.Provider>;
}
