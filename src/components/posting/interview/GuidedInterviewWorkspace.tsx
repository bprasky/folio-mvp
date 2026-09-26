'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Loader2, Mic, Pause, Square, X } from 'lucide-react';
import { GUIDED_ANSWER_LIMIT, type GuidedCommand, type GuidedSession, type GuidedTurn } from '@/lib/interview/guided/types';
import GenerationContextOptions, { useGenerationContext } from '@/components/posting/GenerationContextOptions';
import { useVoiceRecording } from './useVoiceRecording';
import type { RoomPhotoImage } from './RoomPhoto';
import { appendTranscript, emptyGuidedDraft, guidedTextIntent, resolvePhotoTransition, type GuidedLocalDraft, type PendingPhotoTransition } from './guidedWorkspaceState';

interface GuidedInterviewWorkspaceProps {
  projectId: string;
  actorId: string;
  projectName?: string;
  images: RoomPhotoImage[];
  onClose: () => void;
  onDraftGenerated?: () => void;
  initialRoomId?: string | null;
}

const buttonClass = 'rounded-sm px-3 py-2 text-folio-meta font-medium transition-colors hover:bg-surface-ground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:cursor-not-allowed disabled:opacity-50';

export function GuidedInterviewWorkspace({ projectId, actorId, projectName = 'Your project', images, onClose, onDraftGenerated, initialRoomId }: GuidedInterviewWorkspaceProps) {
  const router = useRouter();
  const [session, setSession] = useState<GuidedSession | null>(null);
  const sessionRef = useRef<GuidedSession | null>(null);
  const [draft, setDraft] = useState<GuidedLocalDraft>(emptyGuidedDraft);
  const draftRef = useRef(draft);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [correcting, setCorrecting] = useState<GuidedTurn | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [showSkipRoom, setShowSkipRoom] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [contextChoice, setContextChoice] = useState({ includeBio: true, includeProjectHistory: true });
  const contextAvailability = useGenerationContext(projectId);
  const storageKey = `folio.guided.draft.${actorId}.${projectId}`;
  const endpoint = `/api/posting/project/${encodeURIComponent(projectId)}/interview/guided`;
  const conversationRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const followBottom = useRef(true);
  const [earlierTurns, setEarlierTurns] = useState(false);

  const photos = useMemo(() => [...images].sort((a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)), [images]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const navigationVersion = useRef(0);
  const pendingPhoto = useRef<PendingPhotoTransition | null>(null);
  const previousRoom = useRef<string | null | undefined>(undefined);
  const initialRoomHandled = useRef(false);
  const activeQuestion = session?.plan.find(question => question.id === (correcting?.questionId ?? session.activeQuestionId)) ?? null;
  const activeQuestionRef = useRef(activeQuestion);
  activeQuestionRef.current = activeQuestion;
  const photo = photos.find(image => image.id === selectedImageId) ?? photos[0];
  const roomName = (roomId: string | null | undefined) => session?.rooms.find(room => room.id === roomId)?.name ?? (roomId ? 'Project room' : 'About this project');
  const activeRoomName = roomName(activeQuestion?.roomId);
  const staleDraft = !!draft.text && draft.questionId !== activeQuestion?.id;

  const saveDraft = useCallback((next: GuidedLocalDraft) => {
    draftRef.current = next;
    setDraft(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [storageKey]);

  const voice = useVoiceRecording({
    onTranscriptionComplete: (transcript, metadata) => {
      const current = draftRef.current;
      saveDraft({ ...current, questionId: current.questionId ?? activeQuestionRef.current?.id ?? null,
        text: appendTranscript(current.text, transcript), recordingId: metadata?.recordingId,
        inputModality: current.text && current.inputModality === 'text' ? 'mixed' : current.inputModality === 'mixed' ? 'mixed' : 'voice' });
      composerRef.current?.focus();
    },
  });
  const voiceBusy = voice.isRecording || voice.isTranscribing || voice.status === 'paused';

  const acceptSession = useCallback((next: GuidedSession) => {
    // A late HTTP response cannot move a newer session backwards.
    if (sessionRef.current && next.version < sessionRef.current.version) return;
    sessionRef.current = next;
    setSession(next);
  }, []);

  const sendCommand = useCallback(async (command: GuidedCommand): Promise<GuidedSession | null> => {
    if (inFlight.current) return null;
    inFlight.current = true; setBusy(true); setError('');
    saveDraft({ ...draftRef.current, pending: command });
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      const data = await response.json();
      if (!mounted.current) return null;
      if (data.session) acceptSession(data.session);
      if (!response.ok) {
        if ([400, 409, 422].includes(response.status)) saveDraft({ ...draftRef.current, pending: null });
        if (response.status === 409) {
          const latest = await fetch(endpoint, { cache: 'no-store' });
          if (latest.ok) { const saved = await latest.json(); if (saved.session) acceptSession(saved.session); }
        }
        throw new Error(data.message || data.error || 'Unable to save. Your response is still here.');
      }
      const next = data.session as GuidedSession;
      if (!next) throw new Error('The saved interview could not be loaded. Retry to check its status.');
      if (!next.requestIds.includes(command.requestId)) {
        saveDraft({ ...draftRef.current, pending: null });
        setError(next.notice || 'The project changed before this response was accepted. Review the current question; your response is retained.');
        return null;
      }
      if (['answer', 'correct', 'skip'].includes(command.action)) {
        saveDraft(emptyGuidedDraft()); setCorrecting(null);
      } else saveDraft({ ...draftRef.current, pending: null });
      return next;
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Unable to connect. Your response is still here.');
      return null;
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [acceptSession, endpoint, saveDraft]);

  const command = useCallback((action: GuidedCommand['action'], extra: Partial<GuidedCommand> = {}) => sendCommand({
    action, requestId: crypto.randomUUID(), version: sessionRef.current?.version ?? 0, ...extra,
  }), [sendCommand]);

  const loadSession = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok) throw new Error(data.message || data.error || 'Unable to load your interview.');
      if (data.session) acceptSession(data.session);
      const pending = draftRef.current.pending;
      if (pending) {
        const restored = await sendCommand(pending);
        if (restored?.status === 'paused') await command('resume');
      }
      else if (!data.session) await command('start');
      else if (data.session.status === 'paused') await command('resume');
      else if (data.session.status === 'deciding') await command('retry');
      setLoaded(true);
    } catch (err) {
      if (mounted.current) { setError(err instanceof Error ? err.message : 'Unable to load your interview.'); setLoaded(true); }
    }
  }, [acceptSession, command, endpoint, sendCommand]);

  useEffect(() => {
    mounted.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved.text === 'string' && ['text', 'voice', 'mixed'].includes(saved.inputModality)) {
        draftRef.current = saved; setDraft(saved);
      }
    } catch { setStorageError(true); }
    void loadSession();
    return () => { mounted.current = false; };
  }, [loadSession, storageKey]);

  useEffect(() => {
    if (!loaded || busy || initialRoomHandled.current || !initialRoomId || !session) return;
    if (initialRoomId !== 'project' && !session.roomsPrepared) return;
    initialRoomHandled.current = true;
    const roomId = initialRoomId === 'project' ? null : initialRoomId;
    if (draftRef.current.text || session.status !== 'active' || activeQuestion?.roomId === roomId) return;
    if (session.plan.some(question => question.roomId === roomId && question.status === 'pending')) void command('section', { roomId });
  }, [activeQuestion?.roomId, busy, command, initialRoomId, loaded, session]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (textarea) { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`; }
  }, [draft.text]);

  useEffect(() => {
    if (correcting || !draft.correctingTurnId || !session) return;
    const turn = session.turns.find(value => value.id === draft.correctingTurnId && !value.supersededBy && value.kind !== 'skip');
    if (turn) setCorrecting(turn);
  }, [correcting, draft.correctingTurnId, session]);

  useEffect(() => {
    const container = conversationRef.current;
    if (container && followBottom.current) container.scrollTop = container.scrollHeight;
  }, [session?.version, correcting]);

  useEffect(() => {
    const container = conversationRef.current;
    if (!container) return;
    // Keep the question visible when the mobile keyboard or viewport changes,
    // while preserving an intentional scroll into earlier conversation.
    const observer = new ResizeObserver(() => {
      if (followBottom.current) container.scrollTop = container.scrollHeight;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeQuestion || previousRoom.current === activeQuestion.roomId) return;
    previousRoom.current = activeQuestion.roomId;
    const roomPhotos = session?.rooms.find(room => room.id === activeQuestion.roomId)?.imageIds ?? [];
    const target = [...activeQuestion.sourceImageIds, ...roomPhotos].find(id => photos.some(image => image.id === id)) ?? (!activeQuestion.roomId ? photos[0]?.id : undefined);
    if (target) pendingPhoto.current = { imageId: target, navigationVersion: navigationVersion.current };
  }, [activeQuestion, session?.rooms, photos]);

  useEffect(() => {
    const next = resolvePhotoTransition(pendingPhoto.current, navigationVersion.current, !!draft.text || voiceBusy || busy);
    pendingPhoto.current = next.pending;
    if (next.imageId) setSelectedImageId(next.imageId);
  }, [activeQuestion, busy, draft.text, voiceBusy]);

  const browse = (id: string) => {
    navigationVersion.current += 1;
    pendingPhoto.current = null;
    setSelectedImageId(id);
  };

  const pause = async () => {
    if (voiceBusy || voice.hasRecording) { setError('Finish transcribing or discard the recording before closing.'); return; }
    if (busy || generating) { setError('Please wait for the current save to finish.'); return; }
    saveDraft(draftRef.current);
    if (!sessionRef.current || sessionRef.current.status === 'finished' || sessionRef.current.status === 'ready') { onClose(); return; }
    if (await command('pause')) onClose();
  };

  const submit = async () => {
    if (!activeQuestion || busy || voiceBusy || staleDraft || draft.pending || !draft.text.trim() || draft.text.length > GUIDED_ANSWER_LIMIT) return;
    const intent = guidedTextIntent(draft.text);
    if (intent === 'pause' && !correcting) { saveDraft(emptyGuidedDraft()); await pause(); return; }
    await command(intent === 'skip' && !correcting ? 'skip' : correcting ? 'correct' : 'answer', {
      questionId: activeQuestion.id, text: draft.text, inputModality: draft.inputModality, selectedImageId: draft.selectedImageId, recordingId: draft.recordingId,
    });
    composerRef.current?.focus();
  };

  const startCorrection = (turn: GuidedTurn) => {
    if (draft.text || busy || voiceBusy || draft.pending) { setError('Save or clear your current response before correcting an earlier answer.'); return; }
    setCorrecting(turn);
    saveDraft({ questionId: turn.questionId, text: turn.text, inputModality: 'text', selectedImageId: turn.selectedImageId, correctingTurnId: turn.id, pending: null });
    composerRef.current?.focus();
  };

  const generateDraft = async () => {
    if (busy || generating || draft.text || voiceBusy || voice.hasRecording) return;
    const current = sessionRef.current;
    const finished = current?.status === 'finished' ? current : await command('finish', { confirmPartial: true });
    if (!finished) return;
    setGenerating(true); setError('');
    try {
      const response = await fetch(`/api/posting/project/${encodeURIComponent(projectId)}/interview/generate?forceOverwriteDraft=true&mode=recomposition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceOverwriteDraft: true, mode: 'recomposition', ...contextChoice }),
      });
      if (!response.ok && response.status !== 202) {
        const data = await response.json(); throw new Error(data.message || data.error || 'Draft generation failed. Your interview is saved.');
      }
      onClose();
      if (onDraftGenerated) onDraftGenerated();
      else { router.push(`/project/${projectId}?view=publish`); router.refresh(); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Draft generation failed. Your interview is saved.'); }
    finally { setGenerating(false); }
  };

  const currentTurns = session?.turns ?? [];
  const answers = currentTurns.filter(turn => turn.kind !== 'skip' && !turn.supersededBy && session?.plan.some(question => question.id === turn.questionId && question.status === 'answered'));
  const unfinished = session?.plan.filter(question => ['active', 'pending'].includes(question.status)).length ?? 0;
  const skipped = session?.plan.filter(question => question.status === 'skipped').length ?? 0;
  const shorterCoverage = unfinished > 0 || skipped > 0 || !session?.roomsPrepared || answers.length < (session?.minimumTotalAnswers ?? 0);
  const reviewVisible = showFinish || (session && ['ready', 'finished'].includes(session.status));
  const readyToAnswer = activeQuestion && session?.status === 'active' && !reviewVisible && !showSkipRoom;
  const photoInScope = photo && activeQuestion && (!activeQuestion.roomId || session?.rooms.find(room => room.id === activeQuestion.roomId)?.imageIds.includes(photo.id));
  const photoIndex = photo ? photos.findIndex(image => image.id === photo.id) : 0;
  const savedLabel = generating ? 'Preparing your draft…' : busy ? 'Saving / preparing the next question…' : voice.isTranscribing ? 'Transcribing…' : draft.pending ? 'Save not confirmed — retry' : draft.text ? storageError ? 'Response not saved on this device' : 'Unsent response · saved on this device' : session ? 'All accepted answers saved' : 'Preparing your interview…';

  return <Dialog.Root open onOpenChange={open => { if (!open) void pause(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-folio-text-primary/30" />
      <Dialog.Content onEscapeKeyDown={event => { event.preventDefault(); void pause(); }}
        className="fixed inset-0 z-[101] flex h-[100dvh] flex-col bg-surface-canvas text-folio-text-primary focus:outline-none">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-folio-border-subtle px-4 py-3 md:px-7">
          <div className="min-w-0"><Dialog.Title className="truncate font-headline text-folio-h4">{projectName}</Dialog.Title>
            <Dialog.Description className="text-folio-meta text-folio-text-secondary">Project photographs · Guided interview</Dialog.Description></div>
          <button type="button" onClick={() => void pause()} className={`${buttonClass} flex shrink-0 items-center gap-2`}><Pause size={15} aria-hidden />Pause & close</button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(120px,30dvh)_minmax(0,1fr)] gap-3 p-3 md:grid-cols-[minmax(0,1fr)_390px] md:grid-rows-1 md:gap-6 md:p-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section aria-label="Project photographs" className="flex min-h-0 min-w-0 flex-col gap-2">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-surface-ground">
              {photo ? <Image src={photo.url} alt={photo.name || `${roomName(photo.roomId)} photograph`} fill unoptimized sizes="(min-width: 768px) 65vw, 100vw" className="object-contain" />
                : <div className="flex h-full items-center justify-center p-6 text-folio-body text-folio-text-secondary">Your project photographs will appear here.</div>}
              {photos.length > 1 && <>
                <button aria-label="Previous photograph" onClick={() => browse(photos[(photoIndex - 1 + photos.length) % photos.length].id)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-surface-canvas/95 p-2 shadow-folio1 focus-visible:ring-2 focus-visible:ring-folio-gold"><ChevronLeft size={18} /></button>
                <button aria-label="Next photograph" onClick={() => browse(photos[(photoIndex + 1) % photos.length].id)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-surface-canvas/95 p-2 shadow-folio1 focus-visible:ring-2 focus-visible:ring-folio-gold"><ChevronRight size={18} /></button>
              </>}
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 text-folio-meta text-folio-text-secondary">
              <span className="truncate">{photo ? `${roomName(photo.roomId)} · ${photoIndex + 1} / ${photos.length}` : 'No photographs'}</span>
              {photoInScope && <button type="button" disabled={!!draft.text || voiceBusy || busy || !readyToAnswer} className={buttonClass}
                onClick={() => saveDraft({ ...draftRef.current, questionId: activeQuestion?.id ?? null, selectedImageId: photo.id })}>{draft.selectedImageId === photo.id ? 'Photo linked to this answer' : 'Discuss this photo'}</button>}
            </div>
            <div className="hidden shrink-0 gap-2 overflow-x-auto pb-1 md:flex" aria-label="Choose a photograph">
              {photos.map(image => <button key={image.id} aria-label={`View ${image.name || roomName(image.roomId)} photograph`} aria-pressed={photo?.id === image.id}
                className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-sm border-2 focus-visible:ring-2 focus-visible:ring-folio-gold ${photo?.id === image.id ? 'border-folio-gold' : 'border-transparent'}`} onClick={() => browse(image.id)}>
                <Image src={image.url} alt="" fill unoptimized sizes="80px" className="object-cover" />
              </button>)}
            </div>
          </section>

          <section aria-label="Conversation with Folio" className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-folio-border-subtle bg-surface-canvas shadow-folio2 md:max-h-[min(720px,100%)] md:self-end">
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-folio-border-subtle px-4 py-3">
              <div><p className="font-headline text-folio-h4">Folio <span className="font-body text-folio-meta text-folio-text-secondary">AI interviewer</span></p>
                <p className="text-folio-meta text-folio-text-secondary">{activeRoomName}</p></div>
              {session && <details className="relative text-folio-meta"><summary className="cursor-pointer rounded-sm px-2 py-1 focus-visible:ring-2 focus-visible:ring-folio-gold">Sections</summary>
                <ul className="absolute right-0 top-full z-10 mt-2 max-h-56 w-60 overflow-auto rounded-sm border border-folio-border-subtle bg-surface-canvas p-3 shadow-folio2">
                  {[{ id: null, name: 'About this project' }, ...session.rooms.filter(room => room.id !== 'project')].map(room => {
                    const questions = session.plan.filter(question => question.roomId === room.id && question.kind === 'prepared');
                    const answered = questions.filter(question => question.status === 'answered').length;
                    const skipped = questions.filter(question => question.status === 'skipped').length;
                    const pending = questions.some(question => ['pending', 'active'].includes(question.status));
                    return <li key={room.id || 'project'} className="py-1"><button className={`${buttonClass} w-full text-left`} disabled={!pending || busy || voiceBusy || voice.hasRecording || !!draft.text || !!draft.pending || session.status !== 'active'}
                      onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); setShowFinish(false); setShowSkipRoom(false); void command('section', { roomId: room.id }); }}>{room.name}: {answered} answered{skipped ? `, ${skipped} skipped` : ''}{!questions.length ? ' · not prepared yet' : ''}</button></li>;
                  })}
                </ul>
              </details>}
            </div>

            <div ref={conversationRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 md:min-h-40" role="log" aria-label="Interview conversation"
              onScroll={event => { const el = event.currentTarget; followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70; setEarlierTurns(!followBottom.current); }}>
              {initialRoomId && !session?.roomsPrepared && <p className="text-folio-meta text-folio-text-secondary">We’ll finish the project context before preparing the room questions.</p>}
              {currentTurns.map(turn => {
                const question = session?.plan.find(value => value.id === turn.questionId);
                return <ConversationTurn key={turn.id} turn={turn} roomName={roomName(turn.roomId)} excluded={question?.status === 'invalidated'} onCorrect={() => startCorrection(turn)} canCorrect={!busy && !voiceBusy && !turn.supersededBy && turn.kind !== 'skip' && question?.status === 'answered'} />;
              })}
              {!session && <p className="text-folio-body text-folio-text-secondary">{loaded && error ? 'Your interview is still here. Reconnect to continue.' : 'Preparing questions from your project context…'}</p>}
              {session?.notice && <p role="status" className="text-folio-meta text-folio-text-secondary">{session.notice}</p>}
              {session?.status === 'deciding' && !busy && <button type="button" className={buttonClass} onClick={() => void command('retry')}>Retry next question</button>}
              {session?.status === 'paused' && !busy && <button type="button" className={buttonClass} onClick={() => void command('resume')}>Resume interview</button>}
              {session?.status === 'needs_review' && <div><p className="text-folio-body text-folio-text-secondary">Project context has changed. Your earlier answers are preserved; review the updated questions before continuing.</p><button className={buttonClass} disabled={busy || !!draft.text} onClick={() => void command('resume')}>Continue with updated context</button></div>}
              {showSkipRoom && <div className="space-y-3 rounded-sm bg-surface-ground p-3"><p className="text-folio-body">Skip the remaining questions for {activeRoomName}? Your existing answers will still be used. A room with no answers will appear as photographs.</p><button className={buttonClass} disabled={busy} onClick={() => void command('skip_room').then(next => { if (next) setShowSkipRoom(false); })}>Skip remaining room questions</button><button className={buttonClass} disabled={busy} onClick={() => setShowSkipRoom(false)}>Keep this room</button></div>}
              {reviewVisible && <div className="space-y-4">
                <h2 className="font-headline text-folio-h4">Ready for a first draft?</h2>
                <p className="text-folio-body text-folio-text-secondary">{answers.length} saved {answers.length === 1 ? 'answer' : 'answers'}.{shorterCoverage ? ` ${skipped ? `${skipped} questions were skipped. ` : ''}This draft will have shorter coverage. Rooms with less material will be shorter; rooms without answers appear as photographs.` : ' You can review and edit the writing before choosing to publish.'}</p>
                <GenerationContextOptions availability={contextAvailability} value={contextChoice} onChange={setContextChoice} bioMissingHint={false} />
                <button disabled={!answers.length || busy || generating || !!draft.text || voice.hasRecording} className="w-full rounded-sm bg-folio-text-primary px-4 py-3 text-folio-ui font-medium text-white disabled:opacity-50" onClick={() => void generateDraft()}>{generating ? 'Preparing draft…' : 'Prepare editable draft'}</button>
                <p className="text-folio-meta text-folio-text-secondary">Nothing is published until you explicitly publish it.</p>
                {showFinish && session?.status !== 'finished' && <button className={buttonClass} onClick={() => setShowFinish(false)}>Keep talking</button>}
                {session?.status === 'finished' && unfinished > 0 && <button className={buttonClass} disabled={busy} onClick={() => { setShowFinish(false); void command('resume'); }}>Resume remaining questions</button>}
              </div>}
            </div>

            {earlierTurns && <button className={`${buttonClass} mx-4 flex items-center justify-center gap-2`} onClick={() => { followBottom.current = true; setEarlierTurns(false); if (conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight; }}><ArrowDown size={14} />Latest question</button>}
            {activeQuestion && !reviewVisible && <div key={activeQuestion.id} className="max-h-40 shrink-0 overflow-y-auto border-t border-folio-border-subtle px-4 py-3" aria-live="polite">
              <p className="mb-2 text-folio-eyebrow font-medium uppercase tracking-wide text-folio-gold">{correcting ? 'Correct your earlier answer' : activeQuestion.kind === 'prepared' ? activeRoomName : 'One detail'}</p>
              <p className="font-headline text-folio-h4 leading-snug" data-testid="guided-current-question">{activeQuestion.text}</p>
            </div>}
            <div className="shrink-0 border-t border-folio-border-subtle p-3">
              {(error || voice.error) && <div role="alert" className="mb-3 rounded-sm border border-folio-border-strong bg-surface-ground p-3 text-folio-meta">
                <p>{error || voice.error}</p>
                {draft.pending ? <button className={buttonClass} disabled={busy} onClick={() => void sendCommand(draft.pending!)}>Retry save</button> : !session ? <button className={buttonClass} onClick={() => void loadSession()}>Retry connection</button> : null}
                {voice.hasRecording && !voiceBusy && <><button className={buttonClass} onClick={() => void voice.transcribeRecording(projectId, activeQuestion?.id ?? '')}>Retry transcription</button><button className={buttonClass} onClick={voice.cancelRecording}>Discard recording</button></>}
                {!voiceBusy && !voice.hasRecording && !busy && !storageError && <button className={buttonClass} onClick={onClose}>Close for now</button>}
                <button aria-label="Dismiss message" className={buttonClass} onClick={() => setError('')}><X size={14} /></button>
              </div>}
              {staleDraft && <div className="mb-3 rounded-sm bg-surface-ground p-3 text-folio-meta" role="status"><p>Your unsent response belongs to an earlier question. It has not been applied to this one.</p><details><summary>Show unsent response</summary><p className="mt-2 whitespace-pre-wrap">{draft.text}</p></details><button className={buttonClass} onClick={() => void navigator.clipboard.writeText(draft.text).catch(() => setError('Select the response text to copy it.'))}>Copy response</button><button className={buttonClass} onClick={() => saveDraft(emptyGuidedDraft())}>Discard unsent response</button></div>}
              {(readyToAnswer || correcting) && !staleDraft && <>
                {draft.selectedImageId && <p className="mb-2 text-folio-meta text-folio-text-secondary">Answer linked to {photos.find(image => image.id === draft.selectedImageId)?.name || 'the selected photograph'}<button className={buttonClass} disabled={voiceBusy || busy || !!draft.pending} onClick={() => saveDraft({ ...draftRef.current, selectedImageId: null })}>Unlink</button></p>}
                <label className="sr-only" htmlFor="guided-response">Your response</label>
                <textarea id="guided-response" ref={composerRef} value={draft.text} rows={2} disabled={busy || voiceBusy || !!draft.pending}
                  aria-describedby="guided-input-help guided-save-status" aria-invalid={draft.text.length > GUIDED_ANSWER_LIMIT}
                  placeholder="Tell Folio about the project…" className="max-h-56 min-h-20 w-full resize-y rounded-sm border border-folio-border-subtle bg-surface-ground p-3 text-folio-body focus:outline-none focus:ring-2 focus:ring-folio-gold disabled:opacity-70"
                  onChange={event => saveDraft({ ...draftRef.current, questionId: activeQuestion?.id ?? null, text: event.target.value, inputModality: draftRef.current.inputModality === 'voice' || draftRef.current.inputModality === 'mixed' ? 'mixed' : 'text' })}
                  onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} />
                <div id="guided-input-help" className="mt-1 text-folio-meta text-folio-text-secondary">{draft.text.length > GUIDED_ANSWER_LIMIT ? `Your full response is retained. Shorten it to ${GUIDED_ANSWER_LIMIT.toLocaleString()} characters before sending.` : `Up to ${GUIDED_ANSWER_LIMIT.toLocaleString()} characters · Ctrl/⌘ + Enter to send`}</div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {voice.isRecording ? <button type="button" className={`${buttonClass} flex items-center gap-2`} onClick={() => void voice.transcribeRecording(projectId, activeQuestion?.id ?? '')}><Square size={15} />Stop · {voice.formatTime(voice.recordingTime)}</button>
                      : <button type="button" aria-label="Start microphone recording" disabled={busy || voiceBusy || !!draft.pending || voice.hasRecording} className={buttonClass} onClick={() => void voice.startRecording()}>{voice.isTranscribing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}</button>}
                    {voice.isRecording && <button type="button" className={buttonClass} onClick={voice.cancelRecording}>Discard</button>}
                    {correcting ? <button className={buttonClass} disabled={busy || voiceBusy} onClick={() => { setCorrecting(null); saveDraft(emptyGuidedDraft()); }}>Cancel correction</button>
                      : <><button type="button" className={buttonClass} disabled={busy || voiceBusy || !!draft.text || !!draft.pending || voice.hasRecording} onClick={() => void command('skip', { questionId: activeQuestion?.id })}>Skip question</button>{activeQuestion?.roomId && <button type="button" className={buttonClass} disabled={busy || voiceBusy || !!draft.text || !!draft.pending || voice.hasRecording} onClick={() => setShowSkipRoom(true)}>Skip room</button>}</>}
                  </div>
                  <button type="button" aria-label={correcting ? 'Save correction' : 'Send response'} disabled={busy || voiceBusy || voice.hasRecording || !!draft.pending || !draft.text.trim() || draft.text.length > GUIDED_ANSWER_LIMIT} onClick={() => void submit()} className="flex items-center gap-2 rounded-sm bg-folio-text-primary px-4 py-2 text-folio-ui font-medium text-white focus-visible:ring-2 focus-visible:ring-folio-gold disabled:opacity-40">{busy ? <Loader2 className="animate-spin" size={16} /> : <ArrowUp size={16} />}{correcting ? 'Save' : 'Send'}</button>
                </div>
              </>}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1"><p id="guided-save-status" role="status" aria-live="polite" className="flex items-center gap-1 text-folio-meta text-folio-text-secondary">{!busy && session && !draft.text && !draft.pending && <Check size={12} aria-hidden />}{savedLabel}</p>
                {answers.length > 0 && !reviewVisible && <button className={buttonClass} disabled={busy || voiceBusy || !!draft.text || !!draft.pending} onClick={() => setShowFinish(true)}>Finish with what I have</button>}</div>
            </div>
          </section>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ConversationTurn({ turn, roomName, onCorrect, canCorrect, excluded }: { turn: GuidedTurn; roomName: string; onCorrect: () => void; canCorrect: boolean; excluded?: boolean }) {
  return <article className={turn.supersededBy ? 'opacity-70' : ''}>
    <p className="mb-1 text-folio-eyebrow text-folio-text-secondary">{roomName}</p>
    <p className="text-folio-body">{turn.questionText}</p>
    <div className="mt-2 rounded-sm bg-surface-ground p-3">
      <p className="mb-1 text-folio-meta font-medium text-folio-text-secondary">You{turn.kind === 'correction' ? ' · correction' : ''}{turn.supersededBy ? ' · replaced by a correction' : ''}</p>
      <p className="whitespace-pre-wrap break-words text-folio-body">{turn.kind === 'skip' ? 'Skipped intentionally' : turn.text}</p>
      {excluded && <p className="mt-2 text-folio-meta text-folio-text-secondary">Excluded from the draft after a correction or source change.</p>}
      {canCorrect && <button type="button" className={`${buttonClass} -ml-3 mt-1`} onClick={onCorrect}>Correct this answer</button>}
    </div>
  </article>;
}
