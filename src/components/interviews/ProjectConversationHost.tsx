'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import type { LiveAdapterSnapshot, ProjectGuideMetadata } from '@/lib/live-interview/adapter-types';
import type { InterviewResetRequest } from '@/lib/interview/reset';
import { LiveInterviewPanel, type LivePanelControls, type LiveStartIntent } from './LiveInterviewPanel';
import { ProjectGuideUploads, type GuidePhoto } from './ProjectGuideUploads';
import { InterviewModal } from '@/components/posting/interview/InterviewModal';

const GuideContext = createContext<{ managed: boolean; manual: boolean; revision: number; open: () => void; requestRestart: () => void } | null>(null);
export const useProjectConversation = () => useContext(GuideContext);
const button = 'rounded-sm border border-border px-4 py-2 text-folio-ui hover:bg-surface-ground disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-folio-gold';

/** This boundary stays at the same page position across upload, room, tag and Story refreshes. */
export function ProjectConversationHost({ projectId, projectName, actorId, activeView, isEmpty, canImport, images, refreshKey, children, interviewContent, initiallyManual = false, canHost = true }: {
  projectId: string; projectName: string; actorId: string; activeView: string; isEmpty: boolean;
  canImport: boolean; images: GuidePhoto[]; refreshKey: string; children: ReactNode; interviewContent?: ReactNode; initiallyManual?: boolean; canHost?: boolean;
}) {
  const router = useRouter();
  const eligible = canHost && (['media', 'story'].includes(activeView) || (isEmpty && !['publish', 'actions', 'boards'].includes(activeView)));
  const [manual, setManual] = useState(initiallyManual);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [guide, setGuide] = useState<ProjectGuideMetadata | null>(null);
  const [revision, setRevision] = useState(0);
  const [localPhotos, setLocalPhotos] = useState<GuidePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [restartOpen, setRestartOpen] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [connection, setConnection] = useState(0);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [question, setQuestion] = useState<LiveAdapterSnapshot['currentQuestion']>(null);
  const [photoMessage, setPhotoMessage] = useState('');
  const [uploadsOpen, setUploadsOpen] = useState(isEmpty && activeView !== 'story');
  const [reviewOpen, setReviewOpen] = useState(false);
  const intent = useRef<LiveStartIntent>({ requestId: crypto.randomUUID(), consumed: false });
  const controls = useRef<LivePanelControls | null>(null);
  const seenAction = useRef('');
  const resetReceipt = useRef<InterviewResetRequest | null>(null);
  const resetInFlight = useRef(false);
  const managed = eligible && !manual && available !== false;
  const toolsAlongside = managed && activeView === 'media' && !isEmpty;
  const focusedInterview = managed && activeView === 'story';
  const shownPhotos = [...images, ...localPhotos.filter(photo => !images.some(saved => saved.id === photo.id))];
  const photo = shownPhotos[photoIndex % Math.max(1, shownPhotos.length)];
  useEffect(() => {
    setPhotoMessage('');
    const index = images.findIndex(image => question?.sourceImageIds.includes(image.id));
    if (index >= 0) setPhotoIndex(index);
  }, [question?.id, images]);
  useEffect(() => { if (activeView === 'story') setUploadsOpen(false); }, [activeView]);
  const onControlsReady = useCallback((next: LivePanelControls | null) => { controls.current = next; }, []);
  const open = useCallback(() => { setManual(false); setAvailable(null); intent.current = { requestId: crypto.randomUUID(), consumed: false }; }, []);
  const fallback = async () => { await controls.current?.stop(); setManual(true); setError(''); };
  const requestRestart = useCallback(() => { setRestartOpen(true); }, []);
  const onSnapshot = useCallback((snapshot?: Omit<LiveAdapterSnapshot, 'state'>) => {
    if (!snapshot?.guide || resetInFlight.current) return;
    const next = snapshot.guide; setGuide(next); setQuestion(snapshot.currentQuestion); setRevision(value => value + 1);
    if (!next.actionId || seenAction.current === next.actionId || next.action === 'none') return;
    seenAction.current = next.actionId;
    if (next.action === 'resume_interview' && next.legacyInterview) { void controls.current?.stop().then(() => { setManual(true); setLegacyOpen(true); }); return; }
    if (next.action === 'start_over') requestRestart();
    else if (next.action === 'open_tagging') router.replace(`/project/${encodeURIComponent(projectId)}?view=media&step=tags&action=tag`, { scroll: false });
    else if (next.action === 'open_upload') { setUploadsOpen(true); document.getElementById(`guide-uploads-${projectId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }, [projectId, requestRestart, router]);
  const previousEligible = useRef(eligible);
  useEffect(() => {
    if (!eligible) void controls.current?.stop();
    else if (!previousEligible.current && !manual) { intent.current = { requestId: crypto.randomUUID(), consumed: false }; setConnection(value => value + 1); }
    previousEligible.current = eligible;
  }, [eligible, manual]);
  const restart = async () => {
    if (resetInFlight.current) return;
    resetInFlight.current = true;
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
      const data = await response.json();
      if (!response.ok || !data.ok) {
        // A rejected command did not clear anything; a deliberate retry must
        // check the current revision. Uncertain failures reuse the exact receipt.
        if (response.status >= 400 && response.status < 500) resetReceipt.current = null;
        throw new Error(data.message || 'The reset could not be confirmed. Retry to check its status.');
      }
      for (const key of [`folio.guided.draft.${actorId}.${projectId}`, `interviewDraft:${projectId}`, `interview-draft-${projectId}`,
        `folio.interview.qcache.flat.${projectId}`, `folio.interview.qcache.grouped.${projectId}`]) {
        try {
          const saved = JSON.parse(localStorage.getItem(key) || 'null');
          if ((data.session && saved?.sessionId === data.session.id) || saved?.resetId === data.resetId) continue;
          localStorage.removeItem(key);
        } catch { /* server reset identity rejects stale drafts */ }
      }
      try {
        // Do not restore the ended call's answers or start-over action when the
        // fresh panel mounts. The reset has already been acknowledged by now.
        sessionStorage.removeItem(`folio.live.session.${JSON.stringify({ kind: 'project_guide', id: projectId })}`);
        sessionStorage.removeItem(`folio.interview.validation.${projectId}`);
      } catch { /* the server still owns the new interview identity */ }
      resetReceipt.current = null; setRestartOpen(false); setGuide(null); setQuestion(null); setRevision(value => value + 1);
      // End/start is deliberate after the destructive reset, never a hidden replay.
      intent.current = { requestId: crypto.randomUUID(), consumed: false }; setConnection(value => value + 1); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please retry restarting your interview.'); }
    finally { resetInFlight.current = false; setResetting(false); }
  };
  return <GuideContext.Provider value={{ managed, manual, revision, open, requestRestart }}>
    <div className={toolsAlongside ? 'mx-auto max-w-[1600px] lg:grid items-start gap-4 lg:grid-cols-[minmax(320px,35%)_minmax(0,1fr)]' : ''}>
    {eligible ? <section className={`mx-auto w-full min-w-0 max-w-[1440px] space-y-5 px-4 py-5 ${toolsAlongside ? 'lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto' : 'md:px-8'}`} aria-label="Folio project conversation">
      {managed ? <>
        <header className="space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/projects" className="inline-flex items-center gap-2 text-folio-meta text-text-secondary"><ArrowLeft size={14} aria-hidden /> Projects</Link><button type="button" aria-label="Use the step-by-step workspace" className="text-folio-meta text-text-secondary underline underline-offset-4" onClick={() => void fallback()}>Step-by-step workspace</button></div>
          <div><p className="text-folio-meta uppercase tracking-widest text-text-secondary">Folio · Podcast-style interview</p><h1 className="mt-1 font-headline text-folio-h3">{projectName}</h1><p className="mt-1 text-folio-meta text-text-secondary">The decisions, surprises and details worth sharing.</p></div>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex gap-1 rounded-full bg-surface-ground p-1" aria-label="Conversation workspace">{[['media', 'Photos & details'], ['story', 'Interview']].map(([view, label]) => <button key={view} type="button" className={`rounded-full px-4 py-2 text-folio-meta ${activeView === view ? 'bg-surface-canvas shadow-sm' : 'text-text-secondary'}`} aria-current={activeView === view ? 'page' : undefined} onClick={() => router.replace(`/project/${encodeURIComponent(projectId)}?view=${view}`, { scroll: false })}>{label}</button>)}</nav>
          <div className="flex items-center gap-4" aria-label="Interview tools">
            {focusedInterview && interviewContent ? <button type="button" className="text-folio-meta underline underline-offset-4" aria-expanded={reviewOpen} aria-controls={`interview-notes-${projectId}`} onClick={() => setReviewOpen(value => !value)}>Review saved answers</button> : null}
            <button type="button" className="text-folio-meta text-text-secondary underline underline-offset-4" onClick={requestRestart}>Start over</button>
          </div>
        </div>
        {focusedInterview && interviewContent ? <div id={`interview-notes-${projectId}`} hidden={!reviewOpen} className="rounded-lg border border-border bg-surface-ground p-5">{interviewContent}</div> : null}
        <div className={photo && !toolsAlongside ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)]' : 'mx-auto max-w-3xl'}>
          <div className={!toolsAlongside ? 'min-w-0 rounded-xl border border-border bg-surface-canvas lg:col-start-2 lg:row-start-1' : 'min-w-0'}>
          <LiveInterviewPanel key={connection} source={{ kind: 'project_guide', id: projectId }} startIntent={intent.current} presentation="primary" onCanonicalChange={onSnapshot} onAvailabilityChange={setAvailable} onControlsReady={onControlsReady} guideRefreshKey={`${refreshKey}:${localPhotos.map(item => item.id).join(',')}`} />
          </div>
          {photo ? <section aria-label="Project photographs" className={toolsAlongside ? 'hidden' : 'min-w-0 space-y-3 lg:col-start-1 lg:row-start-1'}>
            <div className="relative overflow-hidden rounded-xl bg-surface-ground"><img src={photo.url} alt={photo.name || projectName} className="h-[42dvh] min-h-64 w-full object-contain lg:h-[min(56dvh,640px)]" />
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3"><button type="button" className="rounded-full bg-surface-canvas p-3 shadow-sm disabled:opacity-40" aria-label="Previous photo" disabled={shownPhotos.length < 2} onClick={() => setPhotoIndex(value => (value + shownPhotos.length - 1) % shownPhotos.length)}><ChevronLeft size={18} aria-hidden /></button><p className="rounded-full bg-surface-canvas px-4 py-2 text-folio-meta">{(photoIndex % shownPhotos.length) + 1} of {shownPhotos.length}{photo.room ? ` · ${photo.room}` : ''}</p><button type="button" className="rounded-full bg-surface-canvas p-3 shadow-sm disabled:opacity-40" aria-label="Next photo" disabled={shownPhotos.length < 2} onClick={() => setPhotoIndex(value => (value + 1) % shownPhotos.length)}><ChevronRight size={18} aria-hidden /></button></div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Choose a project photograph">{shownPhotos.map((item, index) => <button key={item.id} type="button" className={`shrink-0 overflow-hidden rounded-md border-2 ${photo.id === item.id ? 'border-folio-gold' : 'border-transparent opacity-60 hover:opacity-100'}`} aria-label={`View photo ${index + 1}${item.room ? `: ${item.room}` : ''}`} aria-pressed={photo.id === item.id} onClick={() => setPhotoIndex(index)}><img src={item.url} alt="" loading="lazy" className="h-14 w-16 object-cover" /></button>)}</div>
            {guide?.phase === 'interview' && question ? <div className="flex flex-wrap items-center gap-3"><button type="button" className={button} disabled={!!question.roomId && photo.roomId !== question.roomId} onClick={() => { void controls.current?.linkPhoto(photo.id, question.id).then(ok => setPhotoMessage(ok ? 'This photograph is linked to your current answer.' : 'Wait for the current reply to save before linking this photograph.')); }}>Discuss this photo</button><p role="status" className="text-folio-meta text-text-secondary">{photoMessage}</p></div> : null}
            {guide && guide.photoCount > 0 ? <p className="text-folio-meta text-text-secondary">{guide.photoCount} photographs · {guide.taggedPhotoCount} with product context</p> : null}
          </section> : null}
        </div>
        {available === null ? <p role="status" className="text-folio-meta">Getting your Folio host ready…</p> : null}
        <details id={`guide-uploads-${projectId}`} open={uploadsOpen} onToggle={event => setUploadsOpen(event.currentTarget.open)}><summary className="cursor-pointer py-2 text-folio-ui">Add photographs or a project link</summary><ProjectGuideUploads projectId={projectId} canImport={canImport} onAdded={(_id, added) => { setLocalPhotos(current => [...current, ...added]); router.refresh(); }} /></details>
      </> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-folio-meta text-text-secondary">{available === false ? 'Your project workspace is ready. Live hosting is not available for this account right now.' : 'Continue with photographs, rooms and your saved interview below.'}</p>{available !== false ? <button type="button" className={button} onClick={open}>Return to the conversation</button> : null}</div>}
    </section> : null}
    {!focusedInterview ? <div className="min-w-0" hidden={managed && isEmpty}>{children}</div> : null}
    </div>
    <Dialog.Root open={restartOpen} onOpenChange={next => { if (!resetInFlight.current) setRestartOpen(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-border bg-surface-canvas p-6 shadow-folio3"
          onEscapeKeyDown={event => { if (resetInFlight.current) event.preventDefault(); }}
          onPointerDownOutside={event => { if (resetInFlight.current) event.preventDefault(); }}>
          <Dialog.Title className="font-headline text-folio-h4">Start this interview over?</Dialog.Title>
          <Dialog.Description className="mt-3 text-folio-body text-text-secondary">This permanently clears your interview answers and conversation so you can begin with the first question. Photos, rooms, tags and any existing draft stay in place.</Dialog.Description>
          {resetting ? <p role="status" className="mt-4 text-folio-meta">Clearing your answers…</p> : null}
          {error ? <p role="alert" className="mt-4 text-folio-meta">{error}</p> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild><button type="button" className={button} disabled={resetting}>{error ? 'Close' : 'Keep my answers'}</button></Dialog.Close>
            <button type="button" className={button} disabled={resetting} onClick={() => void restart()}>{error ? 'Retry clearing answers' : 'Clear answers and start over'}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    {legacyOpen ? <InterviewModal open projectId={projectId} projectName={projectName} images={images.map(image => ({ ...image, name: image.name || undefined }))} initialIntent="resume" preferLegacy disableLive onOpenChange={setLegacyOpen} /> : null}
  </GuideContext.Provider>;
}
