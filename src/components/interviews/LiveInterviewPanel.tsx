'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { Mic, MicOff, Video, VideoOff, Captions, Pause, PhoneOff, Keyboard, Square, Volume2, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import type { LiveAdapterSnapshot, LiveSource, ProjectGuideAction, ProjectGuideStep } from '@/lib/live-interview/adapter-types';
import type { LiveTurn } from '@/lib/live-interview/turns';
import { checkCaptureReady, discardStoredCaptures, purgeExpiredCaptures, retryStoredCaptures, startCreatorCapture, type CaptureHandle, type CaptureState } from '@/lib/live-interview/capture';

interface LiveState {
  id: string; status: string; snapshot?: Omit<LiveAdapterSnapshot, 'state'>; turns?: LiveTurn[]; notice?: string;
  join?: { url: string; token: string; conversationId: string }; recordingEnabled?: boolean;
  consent?: { mode: Mode };
}
export interface LiveStartIntent { requestId: string; consumed: boolean; inputMode?: 'voice' | 'text'; settled?: boolean }
export interface LivePanelControls { stop: () => Promise<void>; guide: (action: ProjectGuideAction | 'refresh' | 'return_guide') => Promise<boolean>; linkPhoto: (id: string, questionId: string) => Promise<boolean> }
interface Props { source: LiveSource; startIntent?: LiveStartIntent; onStartingChange?: (starting: boolean) => void; onCanonicalChange?: (snapshot?: Omit<LiveAdapterSnapshot,'state'>, allowGuideActions?: boolean) => void; onActiveChange?: (active: boolean) => void; beforeStart?: () => Promise<void>; selectedImageId?:string|null; onSessionChange?:(id:string)=>void;
  presentation?: 'compact' | 'primary'; onAvailabilityChange?: (available: boolean) => void; onOpenWorkspace?: () => void;
  onControlsReady?: (controls: LivePanelControls | null) => void; guideRefreshKey?: string; recordingSetup?: boolean; workspaceStep?: ProjectGuideStep; callStage?: boolean }
type Mode = 'none' | 'audio' | 'video';
type TypedQuestion = { questionId: string; version: string; questionText: string };
const button = 'rounded-sm border border-border px-3 py-2 text-folio-meta font-medium hover:bg-surface-ground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:cursor-not-allowed disabled:opacity-50';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function CallControl({ primary, icon: Icon, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary: boolean; icon: LucideIcon; children: string }) {
  return <button type="button" {...props} title={primary ? children : undefined} className={primary
    ? `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:cursor-not-allowed disabled:opacity-40 ${children === 'End' ? 'bg-ink text-white hover:bg-ink-600' : 'bg-surface-canvas text-text-primary hover:bg-surface-ground aria-pressed:bg-ink aria-pressed:text-white'}`
    : button}>{primary ? <><Icon size={19} strokeWidth={1.75} aria-hidden /><span className="sr-only">{children}</span></> : children}</button>;
}

async function liveRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), signal: AbortSignal.timeout(120_000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.message || result.error || 'The live interview is unavailable. Your saved answers are unchanged.'), { status: response.status, code: result.code, retryAt: result.retryAt });
  return result as T;
}

/** A passive mount never starts a call. An explicit entry intent is consumed once. */
export function LiveInterviewPanel({ source, startIntent, onStartingChange, onCanonicalChange, onActiveChange, beforeStart, selectedImageId, onSessionChange, presentation = 'compact', onAvailabilityChange, onOpenWorkspace, onControlsReady, guideRefreshKey, recordingSetup = false, workspaceStep, callStage = false }: Props) {
  const fieldId = useId();
  const sourceKey = JSON.stringify(source);
  const workspaceStepRef = useRef(workspaceStep);
  workspaceStepRef.current = workspaceStep;
  const [available, setAvailable] = useState(false);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [mode, setMode] = useState<Mode>('none');
  const [consent, setConsent] = useState(false);
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('video');
  const [mediaConsent, setMediaConsent] = useState(false);
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readySource, setReadySource] = useState<string|null>(null);
  const [startInputOpen, setStartInputOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [state, setState] = useState<LiveState | null>(null);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [caption, setCaption] = useState('');
  const [speaker, setSpeaker] = useState<'pal' | 'user' | null>(null);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<CaptureState | null>(null);
  const [recordingMessage, setRecordingMessage] = useState('');
  const [recovery, setRecovery] = useState<{ position: number; text: string; target: 'current' | 'previous' } | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>(startIntent?.inputMode ?? 'voice');
  const [typedDraft, setTypedDraft] = useState('');
  const [typedQuestion, setTypedQuestion] = useState<TypedQuestion | null>(null);
  const typedReceipt = useRef<{ requestId: string; text: string } | null>(null);
  const typedStorageKey = useRef<string | null>(null);
  const stateRef = useRef<LiveState | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const ending = useRef(false);
  const startKey = useRef<string | null>(startIntent?.consumed && !startIntent.settled ? startIntent.requestId : null);
  const eventTail = useRef(Promise.resolve());
  const eventBacklog = useRef(0);
  const eventKeys = useRef(new Set<string>());
  const callbacks = useRef({ onCanonicalChange, onActiveChange, onStartingChange, onSessionChange, onAvailabilityChange, onOpenWorkspace });
  callbacks.current = { onCanonicalChange, onActiveChange, onStartingChange, onSessionChange, onAvailabilityChange, onOpenWorkspace };
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const lastVersion = useRef('');
  const joinedAt = useRef(0);
  const mountedSource = useRef(sourceKey);
  const sourceEpoch = useRef(0);
  const startEpoch = useRef(0);
  const chooseTextDuringStart = useRef<(() => void) | null>(null);
  const guideReceipt = useRef<{ action: ProjectGuideAction | 'refresh' | 'return_guide' | 'skip' | 'retry'; requestId: string; fromVersion: string; questionId?: string; workspaceStep?: ProjectGuideStep } | null>(null);
  const echoedVersions = useRef(new Set<string>());
  const lastGuide = useRef('');
  const captureStarting = useRef(false);

  useEffect(() => {
    if (!retryAt) return;
    const remaining = Date.parse(retryAt) - Date.now();
    if (!(remaining > 0)) { setRetryAt(null); return; }
    const timer = setTimeout(() => setRetryAt(null), Math.min(remaining, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [retryAt]);

  const setCurrent = useCallback((next: LiveState, allowGuideActions = true) => {
    const changedQuestion = !!next.snapshot && next.snapshot.currentQuestion?.id !== stateRef.current?.snapshot?.currentQuestion?.id;
    stateRef.current = { ...stateRef.current, ...next };
    if (!mounted.current) return;
    setState(stateRef.current);
    if (changedQuestion) setCaption('');
    const receipt = typedReceipt.current;
    if (receipt && next.turns?.some(turn => turn.requestId === receipt.requestId && turn.status === 'saved')) {
      typedReceipt.current = null; setTypedDraft(''); setTypedQuestion(null);
      try { if (typedStorageKey.current) sessionStorage.removeItem(typedStorageKey.current); } catch { /* saved on server */ }
    }
    callbacks.current.onSessionChange?.(next.id);
    // Only an opaque Folio identifier is retained; joining secrets stay in memory.
    try { sessionStorage.setItem(`folio.live.session.${mountedSource.current}`, next.id); } catch { /* server reservation still prevents duplicate calls */ }
    const version = next.snapshot?.version;
    const guideMetadata = JSON.stringify(next.snapshot?.guide ?? null);
    if (version && (version !== lastVersion.current || guideMetadata !== lastGuide.current)) {
      lastVersion.current = version; lastGuide.current = guideMetadata;
      callbacks.current.onCanonicalChange?.(next.snapshot, allowGuideActions && next.status === 'active');
    }
  }, []);
  const progress = useCallback((next: CaptureState, message?: string) => {
    if (mounted.current) { setRecording(next); setRecordingMessage(message || ''); }
  }, []);
  const release = useCallback(async () => {
    const call = callRef.current; callRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (call) { await call.leave().catch(() => {}); await call.destroy().catch(() => {}); }
    if (mounted.current) { setActive(false); setCamera(false); setSpeaker(null); setCaption(''); }
    callbacks.current.onActiveChange?.(false);
    callbacks.current.onStartingChange?.(false);
  }, []);

  const end = useCallback(async (action: 'end' | 'pause' | 'switch_to_text') => {
    if (ending.current) return;
    ending.current = true;
    if (mounted.current) { setBusy(true); setError(''); }
    // Stop capture promptly; the final dataavailable precedes its stop promise.
    const finishing = captureRef.current?.stop().catch(() => {
      progress('incomplete', 'Saved recording chunks need another upload attempt. Keep this page open to retry.');
    });
    const releasing = release();
    try {
      const id = stateRef.current?.id;
      if (id) setCurrent(await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(id)}`, { action }), false);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'The end request could not be confirmed. Retry End; automatic session cleanup remains active.');
    } finally {
      await releasing; await finishing;
      ending.current = false; inFlight.current = false;
      if (mounted.current) setBusy(false);
      callbacks.current.onCanonicalChange?.(stateRef.current?.snapshot, false);
    }
  }, [progress, release, setCurrent]);
  const endRef = useRef(end); endRef.current = end;

  useEffect(() => {
    let cancelled = false;
    sourceEpoch.current++; setReadySource(null);
    setAvailable(false);
    typedStorageKey.current = null;
    void purgeExpiredCaptures().catch(()=>{});
    void (async () => {
      if (mountedSource.current !== sourceKey) {
        await endRef.current('end');
        if (cancelled) return;
        mountedSource.current = sourceKey; startKey.current = null; stateRef.current = null; captureRef.current = null;
        setState(null); setMode('none'); setConsent(false); setRecording(null); setRecovery(null); typedReceipt.current = null;
        setTypedDraft(''); setTypedQuestion(null);
      }
      await liveRequest<{ enabled?: boolean; available?: boolean; recordingEnabled?: boolean; draftScope?: string }>(`/api/live-interviews?source=${encodeURIComponent(sourceKey)}`)
        .then(result => { if (!cancelled) {
          const enabled = result.enabled === true || result.available === true;
          setAvailable(enabled); callbacks.current.onAvailabilityChange?.(enabled); setRecordingAvailable(result.recordingEnabled === true);
          if (enabled && result.draftScope) {
            const key = `folio.live.text.v1.${result.draftScope}`; typedStorageKey.current = key;
            try {
              const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
              if (typeof saved?.text === 'string' && saved.text && typeof saved.questionId === 'string' && typeof saved.version === 'string') {
                setTypedDraft(saved.text); setInputMode('text');
                setTypedQuestion({ questionId: saved.questionId, version: saved.version, questionText: typeof saved.questionText === 'string' ? saved.questionText : 'Your earlier question' });
                if (typeof saved.requestId === 'string') typedReceipt.current = { requestId: saved.requestId, text: saved.text };
              }
            } catch { /* current input stays in memory */ }
          }
        } })
        .catch(() => { if (!cancelled) callbacks.current.onAvailabilityChange?.(false); });
      try {
        const savedId = sessionStorage.getItem(`folio.live.session.${sourceKey}`);
        if (savedId) await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(savedId)}`)
          // Restore progress and pending replies without replaying an old navigation command.
          .then(next => { if (!cancelled) setCurrent(next, false); }).catch(() => {});
      } catch { /* saving interview progress does not depend on browser storage */ }
      if (!cancelled) setReadySource(sourceKey);
    })();
    return () => { cancelled = true; chooseTextDuringStart.current?.(); };
  }, [sourceKey, setCurrent]);

  useEffect(() => {
    mounted.current = true;
    const unload = () => {
      const id = stateRef.current?.id;
      // Best effort only: durable server cleanup and provider timeouts own abandonment.
      if (id && callRef.current) void fetch(`/api/live-interviews/${encodeURIComponent(id)}`, { method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'end' }) }).catch(() => {});
      void captureRef.current?.stop().catch(() => {});
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
    window.addEventListener('pagehide', unload);
    return () => {
      mounted.current = false; sourceEpoch.current++; chooseTextDuringStart.current?.(); window.removeEventListener('pagehide', unload);
      unload(); void release();
    };
  }, [release]);

  useEffect(() => {
    if (!active || !state?.id) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const latest = await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(state.id)}`);
        if (cancelled) return;
        setCurrent(latest);
        if (['ended', 'expired', 'failed', 'ENDED', 'EXPIRED', 'FAILED'].includes(latest.status)) {
          void captureRef.current?.stop().catch(() => {}); await release(); return;
        }
      } catch { if (!cancelled) setError('Connection interrupted. Saved answers remain safe; new speech is awaiting confirmation.'); }
      if (!cancelled) timer = setTimeout(poll, 1_500);
    };
    timer = setTimeout(poll, 1_000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, state?.id, release, setCurrent]);

  const syncTracks = useCallback(() => {
    const remote = Object.values(callRef.current?.participants() || {}).find(participant => !participant.local);
    const video = remote?.tracks.video.persistentTrack;
    const audio = remote?.tracks.audio.persistentTrack;
    if (remoteVideo.current) remoteVideo.current.srcObject = video ? new MediaStream([video]) : null;
    if (remoteAudio.current) {
      remoteAudio.current.srcObject = audio ? new MediaStream([audio]) : null;
      if (audio) void remoteAudio.current.play().catch(() => { if (mounted.current) setAudioBlocked(true); });
    }
    if (localVideo.current) localVideo.current.srcObject = streamRef.current;
  }, []);
  useEffect(() => { if (active) syncTracks(); }, [active, camera, syncTracks]);

  const providerEvent = useCallback((data: unknown, conversationId: string) => {
    const raw = object(data); const properties = object(raw.properties);
    if (raw.message_type !== 'conversation' || !['user', 'pal', 'replica'].includes(String(properties.role))) return;
    if (raw.conversation_id !== undefined && raw.conversation_id !== conversationId) return;
    const type = raw.event_type;
    const role = properties.role === 'replica' ? 'pal' : properties.role;
    if (type === 'conversation.utterance.streaming') {
      if (typeof properties.speech === 'string' && mounted.current) setCaption(`${role === 'user' ? 'You' : 'Folio Interviewer'}: ${properties.speech}`);
      return; // Provisional captions are never an answer-ingestion path.
    }
    if (!['conversation.utterance', 'conversation.started_speaking', 'conversation.stopped_speaking'].includes(String(type)) || !Number.isInteger(raw.seq)) return;
    const key = `${conversationId}:${type}:${raw.seq}:${role}`;
    if (eventKeys.current.has(key)) return;
    eventKeys.current.add(key);
    if (mounted.current && type === 'conversation.started_speaking') setSpeaker(role as 'pal' | 'user');
    if (mounted.current && type === 'conversation.stopped_speaking') setSpeaker(current => current === role ? null : current);
    if (eventKeys.current.size > 1_000) eventKeys.current.delete(eventKeys.current.values().next().value!);
    if (type === 'conversation.utterance' && typeof properties.speech === 'string' && mounted.current)
      setCaption(`${role === 'user' ? 'You' : 'Folio Interviewer'}: ${properties.speech}`);
    // Whitelist documented fields; don't forward perception summaries or unrelated messages.
    const event = { message_type: 'conversation', event_type: type, conversation_id: conversationId, seq: raw.seq,
      ...(typeof raw.timestamp === 'number' ? { timestamp: raw.timestamp } : {}),
      ...(typeof raw.inference_id === 'string' ? { inference_id: raw.inference_id } : {}),
      ...(Number.isInteger(raw.turn_idx) ? { turn_idx: raw.turn_idx } : {}),
      properties: { role, ...(typeof properties.speech === 'string' ? { speech: properties.speech } : {}),
        ...(typeof properties.interrupted === 'boolean' ? { interrupted: properties.interrupted } : {}),
        ...(typeof properties.duration === 'number' ? { duration: properties.duration } : {}) } };
    eventBacklog.current++;
    if (eventBacklog.current > 50) { void endRef.current('pause'); return; }
    const sessionId = stateRef.current?.id;
    const epoch = sourceEpoch.current; const eventStart = startEpoch.current;
    const currentEvent = () => mounted.current && sourceEpoch.current === epoch && startEpoch.current === eventStart
      && stateRef.current?.id === sessionId && !!callRef.current;
    eventTail.current = eventTail.current.then(async () => {
      if (!sessionId) return;
      // Retry the same provider sequence; a new receipt would misattribute old speech.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const next = await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(sessionId)}`, { action: 'event', event });
          if (next.id && currentEvent()) setCurrent(next);
          return;
        } catch {
          if (attempt === 2 && currentEvent()) {
            void endRef.current('pause').finally(() => {
              if (mounted.current && startEpoch.current === eventStart && stateRef.current?.id === sessionId)
                setError(current => current || 'Speech confirmation failed. The call is paused; review the retained turn before continuing.');
            });
          }
        }
      }
    }).catch(() => {}).finally(() => { eventBacklog.current--; });
  }, [setCurrent]);

  const openMicrophone = async (stillWanted: () => boolean = () => true) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable. Choose Type instead to continue with the interviewer.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (!mounted.current || !stillWanted()) { stream.getTracks().forEach(track => track.stop()); throw new Error('The microphone request is no longer needed.'); }
    streamRef.current = stream;
    if (!stream.getAudioTracks().some(track => track.readyState === 'live')) throw new Error('The microphone is not ready. Check its permission or choose Type instead.');
    stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
      if (streamRef.current !== stream) return;
      void endRef.current('pause').finally(() => { if (mounted.current) setError('Microphone access ended. The call stopped; saved answers and uploaded recording remain available.'); });
    }, { once: true }));
    return stream;
  };

  const start = async (fromIntent = false) => {
    if (inFlight.current || ending.current || callRef.current || (retryAt && Date.parse(retryAt) > Date.now())) return;
    const captureMode = fromIntent || source.kind === 'project_guide' ? 'none' : mode;
    if (captureMode !== 'none' && !consent) { setError('Confirm recording consent before starting.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    callbacks.current.onStartingChange?.(true);
    const epoch = sourceEpoch.current;
    const attempt = ++startEpoch.current;
    const currentAttempt = () => mounted.current && sourceEpoch.current === epoch && startEpoch.current === attempt && mountedSource.current === sourceKey;
    let attemptRequestId: string | null = null;
    const endUnclaimedSession = async (id: string) => {
      // A newer attempt can rejoin this same still-active provider session.
      // An obsolete response must not end the connection it has reclaimed.
      if (mounted.current && startEpoch.current !== attempt && (stateRef.current?.id === id
        || (attemptRequestId && mountedSource.current === sourceKey && startKey.current === attemptRequestId))) return;
      await liveRequest(`/api/live-interviews/${encodeURIComponent(id)}`, { action: 'end' });
    };
    let chosenInput = inputMode;
    let chooseTyped: () => void;
    const textChosen = new Promise<null>(resolve => { chooseTyped = () => { chosenInput = 'text'; if (mounted.current) { setInputMode('text'); setMode('none'); setConsent(false); } resolve(null); }; });
    chooseTextDuringStart.current = () => chooseTyped(); setStartInputOpen(true);
    if (fromIntent) { setMode('none'); setConsent(false); }
    callbacks.current.onActiveChange?.(true);
    let startedSessionId: string | undefined;
    try {
      await beforeStart?.();
      let draftAtStart = typedDraft; let questionAtStart = typedQuestion;
      // An answer can finish saving after End stopped polling. Confirm its receipt
      // before starting another call or offering the same text for another question.
      const priorReceipt = typedReceipt.current; const priorId = stateRef.current?.id;
      if (priorReceipt && priorId) {
        const prior = await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(priorId)}`);
        setCurrent(prior, false);
        if (prior.turns?.some(turn => turn.requestId === priorReceipt.requestId && turn.status === 'saved')) {
          draftAtStart = ''; questionAtStart = null;
        }
      }
      if (captureMode !== 'none') await checkCaptureReady(captureMode);
      const microphone = chosenInput === 'voice' ? openMicrophone(() => currentAttempt() && chosenInput === 'voice') : Promise.resolve(null);
      let stream = await Promise.race([microphone.catch(failure => {
        if (fromIntent && currentAttempt()) { chooseTyped(); return null; }
        throw failure;
      }), textChosen]);
      if (!currentAttempt()) return;
      const Daily = (await import('@daily-co/daily-js')).default;
      if (!currentAttempt()) return;
      if (chosenInput === 'text' && stream) {
        streamRef.current = null; stream.getTracks().forEach(track => track.stop()); stream = null;
      }
      if(stream && (streamRef.current!==stream || !stream.getAudioTracks().some(track=>track.readyState==='live')))throw new Error('Microphone access ended before the call could start.');
      // Preserve this key after an ambiguous provider-create result. Never blind retry a paid call.
      startKey.current ??= startIntent?.consumed && !startIntent.settled ? startIntent.requestId : crypto.randomUUID();
      chooseTextDuringStart.current = null; setStartInputOpen(false);
      const requestMode = chosenInput === 'text' ? 'none' : captureMode;
      if (startIntent) { startIntent.requestId = startKey.current; startIntent.inputMode = chosenInput; startIntent.settled = false; }
      let intakeSessionId: string | undefined;
      try { if (source.kind === 'project_guide' && !source.id.startsWith('new:')) intakeSessionId = sessionStorage.getItem(`folio.live.intake.${source.id}`) || undefined; } catch { /* saved project context still follows */ }
      const requestStart = () => {
        attemptRequestId = startKey.current;
        return liveRequest<LiveState>('/api/live-interviews', { source: JSON.parse(sourceKey), requestId: attemptRequestId,
          mode: requestMode, inputMode: chosenInput, consentVersion: '2026-10-01', microphoneReady: !!stream, selectedImageId, workspaceStep: workspaceStepRef.current,
          intakeSessionId });
      };
      let next = await requestStart();
      // A deliberate Resume can discover that Tavus already ended the old call.
      // Replace it once only after confirmed cleanup, never after an uncertain start
      // or while an answer still needs review. Keep the new key if its response is lost.
      if (currentAttempt() && next.status === 'ended' && !next.turns?.some(turn => turn.status !== 'saved')) {
        setCurrent(next, false);
        startKey.current = crypto.randomUUID();
        if (startIntent) { startIntent.requestId = startKey.current; startIntent.settled = false; }
        next = await requestStart();
      }
      startedSessionId = next.id;
      if (!currentAttempt()) {
        if (next.id) await endUnclaimedSession(next.id);
        return;
      }
      if (next.id !== stateRef.current?.id && !next.turns?.some(turn => turn.status !== 'saved')) {
        typedReceipt.current = null;
        try { if (typedStorageKey.current) sessionStorage.setItem(typedStorageKey.current, JSON.stringify({ text: draftAtStart, ...questionAtStart })); } catch { /* input stays in memory */ }
      }
      setCurrent(next);
      if (!mounted.current) { await endRef.current('end'); return; }
      if(stream && (streamRef.current!==stream || !stream.getAudioTracks().some(track=>track.readyState==='live')))throw new Error('Microphone access ended while starting. The provider call is being stopped.');
      if (!next.join?.url || !next.join.token) throw new Error(next.notice || 'The session is being reconciled. Retry with this same request; no second call will be requested.');
      const call = Daily.createCallObject({ audioSource: stream?.getAudioTracks()[0] || false, videoSource: false, startAudioOff: true, startVideoOff: true });
      callRef.current = call;
      const currentCall = () => currentAttempt() && callRef.current === call;
      const syncCallTracks = () => { if (currentCall()) syncTracks(); };
      const disconnected = () => {
        if (!currentCall()) return;
        // release() detaches this call before leave() emits another event. Late
        // events from a replaced call must never shut down its replacement.
        void endRef.current('pause').finally(() => {
          if (currentAttempt() && stateRef.current?.id === next.id && !callRef.current)
            setError(current => current || 'The live call disconnected. Your saved answers are here. Resume when you’re ready.');
        });
      };
      call.on('participant-joined', syncCallTracks).on('participant-updated', syncCallTracks)
        .on('participant-left', event => { if (event?.participant && !event.participant.local && event.reason !== 'hidden') disconnected(); })
        .on('left-meeting', disconnected)
        .on('track-started', syncCallTracks).on('track-stopped', syncCallTracks)
        .on('app-message', event => { if (currentCall()) providerEvent(event?.data, next.join!.conversationId); })
        .on('error', disconnected);
      await call.join({ url: next.join.url, token: next.join.token });
      if (!currentAttempt()) { await call.leave().catch(() => {}); await call.destroy().catch(() => {}); return; }
      if (!currentCall()) return;
      joinedAt.current = performance.now();
      setActive(true); callbacks.current.onActiveChange?.(true); setCamera(false);
      if (requestMode !== 'none' && stream) {
        if (next.recordingEnabled === false) throw new Error('Recording could not start. This session has been stopped; choose another mode.');
        const capture = await startCreatorCapture({ sessionId: next.id, stream, mode: 'audio', offsetMs: Math.round(performance.now() - joinedAt.current), onProgress: progress });
        if (!currentCall()) { await capture.stop(); return; }
        captureRef.current = capture;
      } else { captureRef.current = null; setRecording(null); }
      call.setLocalAudio(!!stream); setMuted(!stream); syncTracks();
      captureRef.current?.setMuted(!stream);
      if (startIntent?.requestId === startKey.current) startIntent.settled = true;
      startKey.current = null;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'The live interview could not start.';
      const detail = object(failure);
      if (detail.code === 'LIVE_DAILY_LIMIT' && typeof detail.retryAt === 'string' && Number.isFinite(Date.parse(detail.retryAt))) setRetryAt(detail.retryAt);
      if (startedSessionId && currentAttempt()) await endRef.current('end');
      else if (startedSessionId) await endUnclaimedSession(startedSessionId).catch(() => {});
      else if (currentAttempt()) await release();
      // An older restored session says nothing about an unacknowledged new start.
      // Rotate only after this attempt's own session is confirmed terminal.
      if (currentAttempt() && startedSessionId && startedSessionId === stateRef.current?.id && ['ended', 'expired', 'failed'].includes(stateRef.current.status.toLowerCase())
        && !stateRef.current.turns?.some(turn => turn.status !== 'saved')) {
        if (startIntent?.requestId === startKey.current) startIntent.settled = true;
        startKey.current = null;
      }
      if (currentAttempt()) setError(message);
    } finally {
      if (currentAttempt()) {
        chooseTextDuringStart.current = null; setStartInputOpen(false); callbacks.current.onStartingChange?.(false);
        // A disconnect can finish join() while its shutdown request is still
        // pending. Keep Resume locked until that request can no longer overwrite it.
        if (!ending.current) { inFlight.current = false; setBusy(false); }
      }
    }
  };
  const startRef = useRef(start); startRef.current = start;
  useEffect(() => {
    if (!startIntent || startIntent.consumed || !available || readySource !== sourceKey || inFlight.current || callRef.current) return;
    startIntent.consumed = true;
    startKey.current = startIntent.requestId;
    void startRef.current(true);
  }, [available, readySource, sourceKey, startIntent, busy]);

  const changeInput = async (next: 'voice' | 'text') => {
    if (next === 'text' && chooseTextDuringStart.current) { chooseTextDuringStart.current(); return; }
    if (busy || next === inputMode || (next === 'voice' && !!typedDraft.trim())) return;
    setError('');
    if (!active) { setInputMode(next); if (next === 'text') { setMode('none'); setConsent(false); } return; }
    setBusy(true);
    try {
      if (next === 'text') {
        callRef.current?.setLocalAudio(false);
        const finishing = captureRef.current?.stop().catch(() => progress('incomplete', 'Your recording is retained for upload retry. You can continue typing.'));
        const stream = streamRef.current; streamRef.current = null;
        stream?.getTracks().forEach(track => { track.enabled = false; track.stop(); });
        setMuted(true); setCamera(false); setInputMode('text'); setMode('none'); setConsent(false);
        await callRef.current?.setInputDevicesAsync({ audioSource: false, videoSource: false });
        await finishing;
      } else {
        const stream = await openMicrophone();
        if (!callRef.current || !mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
        await callRef.current.setInputDevicesAsync({ audioSource: stream.getAudioTracks()[0] });
        callRef.current.setLocalAudio(true); setMuted(false); setInputMode('voice');
      }
    } catch (failure) {
      if (next === 'voice') { const stream = streamRef.current; streamRef.current = null; stream?.getTracks().forEach(track => track.stop()); }
      setError(failure instanceof Error ? failure.message : 'The input could not change. Your interview remains open.');
    } finally { if (mounted.current) setBusy(false); }
  };

  const updateTypedDraft = (text: string, binding?: { questionId: string; version: string; questionText: string }) => {
    setTypedDraft(text);
    const snapshot = stateRef.current?.snapshot;
    const question = !text ? null : binding ?? typedQuestion ?? (snapshot?.currentQuestion ? { questionId: snapshot.currentQuestion.id, version: snapshot.version, questionText: snapshot.currentQuestion.text } : null);
    setTypedQuestion(question);
    try { if (typedStorageKey.current) sessionStorage.setItem(typedStorageKey.current, JSON.stringify({ text, ...question })); } catch { /* current input stays in memory */ }
  };
  const sendTyped = async (offered?: { text: string; questionId: string }) => {
    const current = stateRef.current;
    const text = offered?.text ?? typedDraft;
    if (busy || inFlight.current || !active || !callRef.current || !current?.snapshot?.currentQuestion || !text.trim()) return;
    if (offered && (typedDraft.trim() || typedReceipt.current || offered.questionId !== current.snapshot.currentQuestion.id || offered.text !== current.snapshot.guide?.offeredDetail?.text)) return;
    const question = offered ? { questionId: offered.questionId, version: current.snapshot.version, questionText: current.snapshot.currentQuestion.text } : typedQuestion;
    if (!question || question.questionId !== current.snapshot.currentQuestion.id || question.version !== current.snapshot.version) {
      setError('The question changed while you were typing. Review which question this reply belongs to before sending.'); return;
    }
    inFlight.current = true; setBusy(true); setError('');
    const receipt = typedReceipt.current ?? { requestId: crypto.randomUUID(), text };
    typedReceipt.current = receipt;
    try { if (typedStorageKey.current) sessionStorage.setItem(typedStorageKey.current, JSON.stringify({ ...receipt, ...question })); } catch { /* server registration retains the submitted reply */ }
    try {
      if (offered) { setTypedDraft(text); setTypedQuestion(question); await changeInput('text'); }
      const next = await liveRequest<LiveState & { textRegistration: { created: boolean; requestId: string } }>(`/api/live-interviews/${encodeURIComponent(current.id)}`, {
        action: 'prepare_text', ...receipt, questionId: question.questionId, version: question.version,
      });
      setCurrent(next);
      if (!next.textRegistration.created) {
        setError('This reply is already retained. Waiting for confirmation; end the call to review it if delivery cannot be confirmed.'); return;
      }
      if (!mounted.current || !callRef.current || !stateRef.current?.join) throw new Error('The call disconnected. Your reply is retained for review.');
      callRef.current.sendAppMessage({ message_type: 'conversation', event_type: 'conversation.respond',
        conversation_id: stateRef.current.join.conversationId, properties: { text: receipt.text } }, '*');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your reply is retained. End the call to review it before trying again.');
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };

  const openWorkspace = async () => {
    if (active) await end('end');
    callbacks.current.onOpenWorkspace?.();
  };

  const control = async (action: 'skip' | 'retry') => {
    if (!state?.id || busy || (state.snapshot?.guide && (typedDraft.trim() || typedReceipt.current))) return;
    if (state.snapshot?.guide) { await guideControl(action); return; }
    if (active) await end('switch_to_text');
    setBusy(true); setError('');
    try {
      await eventTail.current;
      const next = await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(state.id)}`, { action: 'control', command: { action, requestId: crypto.randomUUID(), questionId: state.snapshot?.currentQuestion?.id } });
      setCurrent(next);
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The interview could not be updated.'); }
    finally { setBusy(false); }
  };
  const recover = async () => {
    if (!recovery || !state?.id) return;
    if (active) await end('switch_to_text');
    setBusy(true); setError('');
    try {
      setCurrent(await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(state.id)}`, { action: 'recover', turnPosition: recovery.position, target: recovery.target, text: recovery.text }));
      setRecovery(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Review could not be saved. Your text is still here.'); }
    finally { setBusy(false); }
  };
  const refreshReview = async () => {
    if(!state?.id || busy)return;
    if(active)await end('switch_to_text');
    setBusy(true);setError('');
    try {setCurrent(await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(state.id)}`,{action:'refresh_review'}));setRecovery(null);}
    catch(failure){setError(failure instanceof Error?failure.message:'Current interview state could not be loaded. Your original speech is retained.');}
    finally{setBusy(false);}
  };
  const guideControl = useCallback(async (action: ProjectGuideAction | 'refresh' | 'return_guide' | 'skip' | 'retry', quiet = false) => {
    const current = stateRef.current;
    if (!current?.id || !current.snapshot?.guide || inFlight.current || typedDraft.trim() || typedReceipt.current) return false;
    if (guideReceipt.current && guideReceipt.current.action !== action) { if (!quiet) setError('Retry the previous conversation choice before choosing another.'); return false; }
    guideReceipt.current ??= { action, requestId: crypto.randomUUID(), fromVersion: current.snapshot.version, questionId: current.snapshot.currentQuestion?.id, workspaceStep: workspaceStepRef.current };
    const receipt = guideReceipt.current;
    inFlight.current = true; setBusy(true); if (!quiet) setError('');
    try {
      await eventTail.current;
      const next = await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(current.id)}`, { action: 'control',
        command: action === 'skip' || action === 'retry' ? { action, requestId: receipt.requestId, questionId: receipt.questionId } : { action: 'guide', guideAction: action, requestId: receipt.requestId, workspaceStep: receipt.workspaceStep } });
      setCurrent(next);
      const question = next.snapshot?.currentQuestion;
      const version = next.snapshot?.version;
      if (callRef.current && question && version && version !== receipt.fromVersion && !echoedVersions.current.has(version) && stateRef.current?.join) {
        // This is server-prepared host speech, never a fabricated designer answer.
        callRef.current.sendAppMessage({ message_type: 'conversation', event_type: 'conversation.echo',
          conversation_id: stateRef.current.join.conversationId, properties: { text: [question.reaction, question.text].filter(Boolean).join(' ') } }, '*');
        echoedVersions.current.add(version);
      }
      guideReceipt.current = null;
      return true;
    } catch (failure) {
      const status = (failure as { status?: number }).status;
      if (status && status < 500) guideReceipt.current = null;
      if (mounted.current && (!quiet || !status || status >= 500)) setError(failure instanceof Error ? failure.message : 'Wait for your current reply to save, then try again.'); return false;
    }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }, [setCurrent, typedDraft]);
  useEffect(() => {
    onControlsReady?.({ guide: guideControl, linkPhoto: async (id, questionId) => {
      const current = stateRef.current;
      if (!current?.id || current.snapshot?.currentQuestion?.id !== questionId || inFlight.current || typedDraft.trim() || typedReceipt.current) return false;
      inFlight.current = true; setBusy(true); setError('');
      try { await eventTail.current; setCurrent(await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(current.id)}`, { action: 'link_image', questionId, selectedImageId: id })); return true; }
      catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'The photo could not be linked.'); return false; }
      finally { inFlight.current = false; if (mounted.current) setBusy(false); }
    }, stop: async () => {
      sourceEpoch.current++; chooseTextDuringStart.current?.(); chooseTextDuringStart.current = null;
      await endRef.current('end');
    } });
    return () => onControlsReady?.(null);
  }, [guideControl, onControlsReady, setCurrent, typedDraft]);
  const refreshedGuide = useRef(guideRefreshKey);
  const guideRefreshAttempt = useRef('');
  useEffect(() => {
    if (!active || busy || !guideRefreshKey || (refreshedGuide.current === guideRefreshKey && (!workspaceStep || state?.snapshot?.guide?.workspaceStep === workspaceStep)) || typedDraft.trim() || typedReceipt.current || !state?.snapshot?.guide) return;
    const attempt = `${workspaceStep}:${guideRefreshKey}:${state.snapshot.version}`;
    if (guideRefreshAttempt.current === attempt) return;
    guideRefreshAttempt.current = attempt;
    void guideControl('refresh', true).then(ok => { if (ok) refreshedGuide.current = guideRefreshKey; });
  }, [active, busy, guideControl, guideRefreshKey, state, typedDraft, workspaceStep]);
  useEffect(() => {
    if (source.kind !== 'project_guide' || !workspaceStep || workspaceStep === 'story') return;
    // Returning to setup finishes the clip while retaining the host connection.
    void captureRef.current?.stop().catch(() => progress('incomplete', 'Retry the final recording upload.'));
    streamRef.current?.getVideoTracks().forEach(track => { streamRef.current?.removeTrack(track); track.stop(); });
    setCamera(false);
  }, [source.kind, workspaceStep, progress]);
  const retryRecording = async () => {
    try {
      if (captureRef.current) await captureRef.current.retry();
      else if (state?.id) await retryStoredCaptures(state.id, progress);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Recording recovery failed. Keep this page open to retry.'); }
  };
  const toggleCamera = async () => {
    if (!state?.id || !streamRef.current || busy || mode !== 'video') return;
    setBusy(true); setError('');
    let acquired: MediaStream | null = null;
    try {
      if (!camera) acquired = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
      await captureRef.current?.stop();
      if (camera) {
        streamRef.current.getVideoTracks().forEach(track => { track.stop(); streamRef.current?.removeTrack(track); });
      } else acquired?.getVideoTracks().forEach(track => streamRef.current?.addTrack(track));
      const nextMode = camera ? 'audio' : 'video';
      captureRef.current = await startCreatorCapture({ sessionId: state.id, stream: streamRef.current, mode: nextMode,
        offsetMs: Math.round(performance.now() - joinedAt.current), onProgress: progress, initiallyMuted: muted });
      captureRef.current.setMuted(muted); setCamera(!camera);
    } catch (failure) {
      acquired?.getTracks().forEach(track => track.stop());
      setError(failure instanceof Error ? failure.message : 'Camera recording could not start. Your saved audio is retained.');
    } finally { setBusy(false); }
  };

  const recordMedia = async () => {
    if (captureStarting.current || busy || !active || !mediaConsent || !recordingAvailable || inputMode !== 'voice' || !stateRef.current?.id || !callRef.current || !streamRef.current) return;
    captureStarting.current = true; setBusy(true); setError('');
    const sessionId = stateRef.current.id; const stream = streamRef.current; const epoch = sourceEpoch.current;
    let acquired: MediaStream | null = null;
    const stillHere = () => mounted.current && sourceEpoch.current === epoch && stateRef.current?.id === sessionId && streamRef.current === stream && !!callRef.current && !ending.current && (!workspaceStepRef.current || workspaceStepRef.current === 'story');
    try {
      await checkCaptureReady(mediaMode);
      if (mediaMode === 'video') acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
      if (!stillHere()) return;
      const next = await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(sessionId)}`, { action: 'consent_recording', mode: mediaMode, consent: true, consentVersion: '2026-10-01' });
      if (!stillHere()) return;
      setCurrent(next);
      // Finish any earlier stopped run before starting a new recorder manifest.
      await captureRef.current?.stop();
      if (!stillHere()) return;
      acquired?.getVideoTracks().forEach(track => stream.addTrack(track));
      const capture = await startCreatorCapture({ sessionId, stream, mode: mediaMode, offsetMs: Math.round(performance.now() - joinedAt.current), onProgress: progress, initiallyMuted: muted });
      if (!stillHere()) { await capture.stop(); return; }
      captureRef.current = capture; setMode(mediaMode); setCamera(mediaMode === 'video'); setMediaConsent(false);
      acquired = null; // The call owns the local tracks until Stop/Pause/End.
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Recording could not start. Your conversation can continue.');
    } finally {
      acquired?.getTracks().forEach(track => { stream.removeTrack(track); track.stop(); });
      captureStarting.current = false; if (mounted.current) setBusy(false);
    }
  };

  if (!available && !state) return null;
  const unresolved = state?.turns?.filter(turn => turn.status === 'needs_review') || [];
  const savedTurns = state?.turns?.filter(turn => turn.status === 'saved') || [];
  const pendingTyped = state?.turns?.find(turn => turn.inputMode === 'text' && turn.status !== 'saved');
  const awaitingReply = !!typedReceipt.current || !!pendingTyped;
  const draftQuestionChanged = !!typedDraft && !!typedQuestion && !!state?.snapshot
    && (typedQuestion.questionId !== state.snapshot.currentQuestion?.id || typedQuestion.version !== state.snapshot.version);
  const primary = presentation === 'primary';
  const projectHost = primary && source.kind === 'project_guide';
  const guide = state?.snapshot?.guide;
  const hasRecording = mode !== 'none' || !!recording || (!!state?.consent?.mode && state.consent.mode !== 'none');
  const notice = state?.notice || state?.snapshot?.notice;
  const replySaving = !!typedReceipt.current || state?.turns?.some(turn => turn.status === 'awaiting_final' || turn.status === 'saving');
  const callStatus = audioBlocked ? 'Sound is off' : speaker === 'pal' ? 'Host speaking' : speaker === 'user' ? 'Listening to you' : unresolved.length ? 'Reply needs review' : replySaving ? 'Saving your reply' : inputMode === 'text' ? 'Ready for your reply' : muted ? 'Microphone muted' : 'Connected';
  const guideLabels: Partial<Record<ProjectGuideAction, string>> = { start_interview: 'Let’s talk about the project', resume_interview: 'Continue our conversation', start_over: 'Start over', add_more: 'Add another detail', open_upload: 'Add photographs', open_tagging: 'Tag project details' };
  return <section aria-label="Live interview" className={`w-full min-w-0 text-folio-body text-text-primary ${primary ? 'overflow-hidden rounded-xl border border-border bg-surface-canvas shadow-folio2' : 'rounded-sm border border-border bg-surface-canvas p-4'}`}>
    <div className={primary && active ? 'sr-only' : `flex items-start justify-between gap-3 ${primary ? 'p-4' : ''}`}>
      <div><h3 className={primary ? 'font-headline text-folio-h4' : 'text-folio-ui font-semibold'}>{active || projectHost ? 'Your Folio host' : 'Tell the story behind your work'}</h3><p className="text-folio-meta text-text-secondary">AI host · your project, in your words</p></div>
      <span className="text-folio-meta" role="status">{active ? 'Live' : busy ? 'Connecting…' : error ? 'Connection paused' : 'Ready'}</span>
    </div>
    {!active ? <div className={primary ? 'space-y-3 px-4 pb-4' : 'mt-3 space-y-3'}>
      {primary ? <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-lg bg-surface-ground px-6 text-center" aria-label="Interviewer preview">
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-12 w-12 text-folio-text-secondary" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="12" width="26" height="24" rx="6" /><path d="m31 19 12-6v22l-12-6" /></svg>
        <p className="font-headline text-folio-h4">{error ? 'Let’s reconnect' : busy ? 'Your host is joining you' : 'The story behind your work'}</p>
        <p className="max-w-sm text-folio-meta text-text-secondary">{startIntent && (!startIntent.consumed || busy) && !error ? 'Take a look through your photographs while we connect.' : error ? 'Your saved answers are still here.' : 'A conversation about the thinking behind the photographs.'}</p>
      </div> : null}
      {!projectHost ? <p className="text-folio-meta">{inputMode === 'voice' ? 'Speak naturally with your interviewer. Your answers are saved as you go.' : 'Type your replies while your interviewer stays on screen and speaks. Your microphone stays off.'}</p> : null}
      {!!typedDraft && !awaitingReply ? <div className="space-y-2 rounded-sm bg-surface-ground p-3 text-folio-meta" aria-label="Unsent typed reply">
        <p className="font-medium">Your unsent reply</p><p className="text-text-secondary">{typedQuestion?.questionText}</p>
        <p className="max-h-32 overflow-auto whitespace-pre-wrap break-words">{typedDraft}</p>
        <button type="button" className={button} disabled={busy} onClick={() => updateTypedDraft('')}>Clear unsent reply</button>
      </div> : null}
      {recordingAvailable && inputMode === 'voice' && !projectHost ? <fieldset disabled={busy} className="space-y-2"><legend className="text-folio-meta font-medium">Recording preference</legend>
        {([['none', 'Interview without saving audio or video'], ['audio', 'Save my voice for media'], ['video', 'Save my voice and camera for media']] as const).map(([value, label]) =>
          <label key={value} className="flex items-start gap-2 text-folio-meta"><input type="radio" name={`${fieldId}-mode`} value={value} checked={mode === value} disabled={value !== 'none' && !recordingAvailable}
            onChange={() => { setMode(value); setConsent(false); }} className="mt-1 accent-folio-gold" /><span>{label}</span></label>)}
      </fieldset> : !projectHost ? <p className="text-folio-meta text-text-secondary">Your camera stays off. Folio saves your answers, without saving an audio or video recording.</p> : null}
      {!projectHost ? <p className="text-folio-meta text-text-secondary">Tavus processes your {inputMode === 'text' ? 'typed replies' : 'speech'} for this AI conversation. Provider processing may include retention.</p> : null}
      {mode !== 'none' && !projectHost ? <label className="flex items-start gap-2 text-folio-meta"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-folio-gold" />
        <span>I consent to private capture and processing of my {mode === 'video' ? 'voice and camera footage' : 'voice'} for media preparation. Publishing requires my separate approval. My camera footage is not sent to the live interviewer.</span></label> : null}
      {mode !== 'none' ? <p className="text-folio-meta text-text-secondary">Upload recovery temporarily stores recording chunks on this device. Capture stops when pending data reaches 25 MiB, retaining the final recorder data. Uploaded chunks are removed; recovery expires after 24 hours and is cleared when Folio next opens. You can discard retained device recordings below.</p> : null}
      {(!startIntent || (!busy && startIntent.consumed)) ? <button type="button" className={primary ? 'w-full rounded-sm bg-folio-text-primary px-4 py-3 text-folio-ui font-medium text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-folio-gold' : button} disabled={busy || !!retryAt || readySource !== sourceKey || (!projectHost && mode !== 'none' && !consent)} onClick={() => void start()}>{retryAt ? 'Live interview available later' : busy ? 'Preparing live interview…' : startIntent && (error || !startIntent.settled) ? 'Retry interview' : inputMode === 'text' ? 'Start with typed replies' : state ? 'Resume live interview' : 'Start live interview'}</button> : null}
      {retryAt ? <p className="text-folio-meta" role="status">Available {new Date(retryAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. Use the step-by-step workspace to keep working now.</p> : null}
      <button type="button" className={`${button} ${primary ? 'w-full border-transparent underline underline-offset-4' : 'ml-2'}`} disabled={(busy && !(startInputOpen && inputMode === 'voice')) || awaitingReply || (inputMode === 'text' && !!typedDraft.trim())} onClick={() => void changeInput(inputMode === 'voice' ? 'text' : 'voice')}>{inputMode === 'voice' ? 'Type instead' : 'Use microphone instead'}</button>
      {state?.id && !['ended', 'ENDED', 'expired', 'EXPIRED'].includes(state.status) ? <button type="button" className={`${button} ml-2`} disabled={busy} onClick={() => void end('end')}>End saved live session</button> : null}
    </div> : null}
    <div className={active ? `space-y-3 ${primary ? '' : 'mt-3'}` : 'hidden'}>
      <div className={primary ? 'relative overflow-hidden rounded-t-xl bg-ink text-white' : 'flex items-end gap-3'} data-testid="host-call-stage">
        {primary ? <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-4"><p className="text-folio-ui font-medium text-white">Folio host</p><p className="text-folio-meta text-white/70">AI interviewer</p></div>
          <span role="status" className="pointer-events-none absolute bottom-4 left-4 z-10 inline-flex max-w-[65%] items-center gap-2 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-folio-meta text-white backdrop-blur-sm"><span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full bg-white ${speaker && !audioBlocked ? 'motion-safe:animate-pulse' : 'opacity-50'}`} />{callStatus}</span>
        </> : null}
        <video ref={remoteVideo} muted autoPlay playsInline aria-label="Folio AI interviewer" className={primary ? `aspect-video w-full object-contain ${callStage ? 'lg:aspect-auto lg:h-[clamp(320px,46dvh,560px)]' : ''}` : 'aspect-video w-40 max-w-full rounded-lg bg-surface-ground object-cover'} />
        {camera ? <video ref={localVideo} muted autoPlay playsInline aria-label="Your private camera preview" className={primary ? 'absolute bottom-4 right-4 aspect-video w-28 rounded-md border border-white/30 bg-ink object-cover shadow-lg' : 'aspect-video w-24 rounded-sm bg-surface-ground object-cover'} /> : null}
        <audio ref={remoteAudio} autoPlay />
        {primary && audioBlocked ? <div className="absolute inset-0 flex items-center justify-center"><button type="button" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-folio-meta text-white shadow-lg backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-white" onClick={() => { void remoteAudio.current?.play().then(() => setAudioBlocked(false)).catch(() => setError('Audio playback is blocked. Check browser sound permissions.')); }}><Volume2 size={16} aria-hidden />Play interviewer audio</button></div> : null}
      </div>
      {!primary && audioBlocked ? <button type="button" className={button} onClick={() => { void remoteAudio.current?.play().then(() => setAudioBlocked(false)).catch(() => setError('Audio playback is blocked. Check browser sound permissions.')); }}>Play interviewer audio</button> : null}
      {!primary && state?.snapshot?.currentQuestion ? <p className="text-folio-ui">{state.snapshot.currentQuestion.text}</p> : null}
      <div className={primary ? 'mx-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-surface-ground p-2 shadow-folio1' : 'flex flex-wrap gap-2'} role="group" aria-label="Call controls">
        {inputMode === 'voice' ? <CallControl primary={primary} icon={muted ? MicOff : Mic} disabled={busy || awaitingReply} aria-pressed={muted} onClick={() => { const next = !muted; streamRef.current?.getAudioTracks().forEach(track=>{track.enabled=!next;}); callRef.current?.setLocalAudio(!next); captureRef.current?.setMuted(next); setMuted(next); }}>{muted ? 'Unmute microphone' : 'Mute microphone'}</CallControl> : null}
        {mode === 'video' && recording === 'recording' ? <CallControl primary={primary} icon={camera ? Video : VideoOff} disabled={busy} onClick={() => void toggleCamera()}>{camera ? 'Turn camera off' : 'Turn camera on for recording'}</CallControl> : null}
        <CallControl primary={primary} icon={Captions} aria-pressed={captions} onClick={() => setCaptions(value => !value)}>Captions</CallControl>
        <CallControl primary={primary} icon={inputMode === 'voice' ? Keyboard : Mic} disabled={busy || awaitingReply || !!unresolved.length || (inputMode === 'text' && !!typedDraft.trim())} onClick={() => void changeInput(inputMode === 'voice' ? 'text' : 'voice')}>{inputMode === 'voice' ? 'Type instead' : 'Use microphone instead'}</CallControl>
        {recording === 'recording' ? <CallControl primary={primary} icon={Square} disabled={busy} onClick={() => {
          void captureRef.current?.stop().catch(() => progress('incomplete', 'Retry the final recording upload.'));
          streamRef.current?.getVideoTracks().forEach(track => { streamRef.current?.removeTrack(track); track.stop(); }); setCamera(false);
        }}>Stop recording</CallControl> : null}
        <CallControl primary={primary} icon={Pause} disabled={busy} onClick={() => void end('pause')}>Pause</CallControl>
        <CallControl primary={primary} icon={PhoneOff} disabled={busy} onClick={() => void end('end')}>End</CallControl>
      </div>
      {primary && captions ? <div className="mx-4 max-h-36 min-h-16 overflow-auto break-words rounded-md bg-surface-ground px-4 py-3 text-folio-ui" aria-live="polite" aria-label="Conversation captions"><p>{caption || state?.snapshot?.currentQuestion?.text || 'Your conversation will appear here.'}</p></div> : null}
      {(!guide || guide.phase === 'interview') ? <div className={primary ? 'px-4 text-right' : ''}><button type="button" className={primary ? `${button} border-transparent text-text-secondary underline underline-offset-4` : button} disabled={busy || !!unresolved.length || (guide && !!typedDraft.trim())} onClick={() => void control('skip')}>{guide ? 'Move on' : 'Skip question'}</button></div> : null}
      {guide ? <div className={primary ? 'flex flex-wrap justify-center gap-2 px-4' : 'flex flex-wrap gap-2'} aria-label="Conversation choices">{guide.allowedActions.filter(action => guideLabels[action] && (!projectHost || ((!workspaceStep || workspaceStep === 'story') && ['start_interview', 'resume_interview', 'add_more'].includes(action)))).map(action => <button key={action} type="button" className={button} disabled={busy || awaitingReply || !!typedDraft.trim() || !!unresolved.length} onClick={() => void guideControl(action)}>{guideLabels[action]}</button>)}{guide.phase === 'interview' && !projectHost ? <button type="button" className={button} disabled={busy || awaitingReply || !!typedDraft.trim()} onClick={() => void guideControl('return_guide')}>Photographs & project details</button> : null}</div> : null}
      {guide?.offeredDetail && guide.offeredDetail.questionId === state?.snapshot?.currentQuestion?.id && !awaitingReply && !typedDraft ? <div className="space-y-2 rounded-sm bg-surface-ground p-3 text-folio-meta"><p>You just shared:</p><p className="whitespace-pre-wrap">{guide.offeredDetail.text}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || !!unresolved.length} onClick={() => void sendTyped(guide.offeredDetail)}>Use what I just shared</button><button type="button" className={button} disabled={busy || !!unresolved.length} onClick={() => { const detail = guide.offeredDetail; const snapshot = stateRef.current?.snapshot; if (!detail || !snapshot?.currentQuestion || detail.questionId !== snapshot.currentQuestion.id) return; const binding = { questionId: detail.questionId, version: snapshot.version, questionText: snapshot.currentQuestion.text }; void changeInput('text').then(() => updateTypedDraft(detail.text, binding)); }}>Edit this detail</button></div></div> : null}
      {inputMode === 'text' ? <form className={primary ? 'space-y-2 px-4' : 'space-y-2'} onSubmit={event => { event.preventDefault(); void sendTyped(); }}>
        <label htmlFor={`${fieldId}-typed`} className="text-folio-meta font-medium">Your reply</label>
        {draftQuestionChanged && !awaitingReply ? <div role="status" className="space-y-2 rounded-sm bg-surface-ground p-3 text-folio-meta">
          <p>This draft was written for: {typedQuestion?.questionText}</p><p>The question has changed. Keep the draft, or explicitly use it for the current question.</p>
          {state?.snapshot?.currentQuestion ? <button type="button" className={button} onClick={() => {
            const snapshot = stateRef.current?.snapshot; if (!snapshot?.currentQuestion) return;
            const question = { questionId: snapshot.currentQuestion.id, version: snapshot.version, questionText: snapshot.currentQuestion.text };
            setTypedQuestion(question); setError('');
            try { if (typedStorageKey.current) sessionStorage.setItem(typedStorageKey.current, JSON.stringify({ text: typedDraft, ...question })); } catch { /* draft stays in memory */ }
          }}>Use this draft for the current question</button> : null}
        </div> : null}
        <textarea id={`${fieldId}-typed`} value={typedDraft || pendingTyped?.raw || ''} onChange={event => updateTypedDraft(event.target.value)} maxLength={2000} rows={projectHost ? 3 : 4}
          disabled={busy || awaitingReply || !!unresolved.length} placeholder="Tell your interviewer about the project…"
          className="w-full rounded-sm border border-border bg-surface-ground p-3 text-folio-body focus-visible:ring-2 focus-visible:ring-folio-gold disabled:opacity-70" />
        <div className="flex items-center justify-between gap-3"><p className="text-folio-meta text-text-secondary">Microphone off · your interviewer still speaks</p>
          <button type="submit" className={button} disabled={busy || awaitingReply || !!unresolved.length || !typedDraft.trim() || draftQuestionChanged}>{awaitingReply ? 'Awaiting saved reply…' : 'Send reply'}</button></div>
        {!!typedDraft && !awaitingReply ? <button type="button" className={`${button} border-transparent text-text-secondary`} disabled={busy} onClick={() => updateTypedDraft('')}>Clear unsent reply</button> : null}
      </form> : null}
      {!primary && captions && caption ? <div className="max-h-32 overflow-auto whitespace-pre-wrap text-folio-meta" aria-live="polite"><p className="text-text-secondary">Live captions</p>{caption}</div> : null}
    </div>
    <div className={`mt-3 space-y-2 text-folio-meta text-text-secondary ${primary ? 'px-4 pb-3' : ''}`} aria-live="polite">
      {state && (!guide || guide.projectId) ? <p>{guide ? `${guide.answeredCount} project answers saved.` : `${savedTurns.length} ${savedTurns.length === 1 ? 'answer' : 'answers'} saved in this live session.`}{state.turns?.some(turn => turn.status === 'awaiting_final' || turn.status === 'saving') ? ' Latest speech is awaiting save.' : ''}</p> : null}
      {recording ? <p>{recording === 'recording' ? `Recording your ${camera ? 'voice and camera' : 'voice'}` : recording === 'uploading' ? 'Finishing private upload…' : recording === 'processing' ? 'Private recording is processing' : 'Recording needs attention'}{recordingMessage ? ` — ${recordingMessage}` : ''}</p> : null}
      {recording === 'incomplete' ? <button type="button" className={button} onClick={() => void retryRecording()}>Retry recording upload</button> : null}
      {state?.id && !active && !recording && hasRecording ? <button type="button" className={button} onClick={() => void retryRecording()}>Recover retained recording uploads</button> : null}
      {state?.id && !active && hasRecording ? <button type="button" className={button} onClick={() => { void discardStoredCaptures(state.id).then(()=>{captureRef.current=null;setRecording(null);setRecordingMessage('Device recovery deleted. Uploaded sources and saved answers are unchanged.');}).catch(()=>setError('Device recovery could not be discarded. Sign in as the interview owner and retry.')); }}>Discard device recording recovery</button> : null}
      {notice && notice !== error ? <p>{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {error && guideReceipt.current ? <button type="button" className={button} disabled={busy} onClick={() => { if (guideReceipt.current) void guideControl(guideReceipt.current.action); }}>Retry conversation choice</button> : null}
    </div>
    {projectHost && recordingSetup && recording !== 'recording' ? <section className="m-4 space-y-3 rounded-lg bg-surface-ground p-4" aria-label="Prepare your interview recording">
      <h4 className="font-headline text-folio-h4">Make something worth sharing</h4>
      <p className="text-folio-meta">Your perspective is the story. Record your voice and camera for clips and a finished interview you can review before publishing.</p>
      <p className="text-folio-meta text-text-secondary">Face a window or soft light, place your camera at eye level, and find a quiet spot. Speak naturally; leave a short pause if you want to try a thought again.</p>
      {recordingAvailable ? <>
        <label className="block text-folio-meta">Save for media <select value={mediaMode} disabled={busy} onChange={event => { setMediaMode(event.target.value as 'audio' | 'video'); setMediaConsent(false); }} className="ml-2 rounded-sm border border-border bg-surface-canvas p-2"><option value="video">Camera and voice</option><option value="audio">Voice only</option></select></label>
        <label className="flex items-start gap-2 text-folio-meta"><input type="checkbox" checked={mediaConsent} disabled={busy} onChange={event => setMediaConsent(event.target.checked)} className="mt-1 accent-folio-gold" /><span>I agree to privately record and process my {mediaMode === 'video' ? 'camera and voice' : 'voice'} for media preparation. I’ll review and approve anything before it is published.</span></label>
        <button type="button" className={button} disabled={busy || !active || !mediaConsent || inputMode !== 'voice' || recording === 'uploading' || recording === 'incomplete'} onClick={() => void recordMedia()}>Record {mediaMode === 'video' ? 'camera and voice' : 'my voice'}</button>
        {inputMode === 'text' ? <p className="text-folio-meta">Switch to your microphone to record. Typed replies still save to your project.</p> : null}
      </> : <p className="text-folio-meta text-text-secondary">Recording is not available yet. Your interview answers are saved; camera and audio files are only saved once recording is enabled and you agree.</p>}
    </section> : null}
    {projectHost ? <details className="m-4 border-t border-border pt-3 text-folio-meta text-text-secondary"><summary className="cursor-pointer">{recording === 'recording' ? `Recording ${camera ? 'camera and voice' : 'voice'} privately` : 'Answers saved · recording is your choice'}</summary><p className="mt-2">Your answers are saved as you go. Recording starts only with your consent; it captures your own voice and optional camera, not the AI host. Private recordings are for media preparation, with separate approval before publication. Tavus processes your {inputMode === 'text' ? 'typed replies' : 'speech'} for the live conversation; provider processing may include retention.</p>{hasRecording ? <p className="mt-2">Upload recovery temporarily retains recording chunks on this device for up to 24 hours. Keep this page open until the upload finishes.</p> : null}</details> : null}
    {projectHost && hasRecording && state?.id ? <a href="/designer/studio/media" target="_blank" rel="noopener noreferrer" className="m-4 inline-block text-folio-meta underline underline-offset-4">Review recordings in Publishing Studio (new tab)</a> : null}
    {savedTurns.length ? <details className={`${primary ? 'm-4' : 'mt-3'} text-folio-meta`}><summary className="cursor-pointer focus-visible:ring-2 focus-visible:ring-folio-gold">{guide ? 'Conversation so far' : 'Saved answers'}</summary>
      <ol className="mt-2 max-h-48 space-y-2 overflow-auto">{savedTurns.map(turn => <li key={turn.position} className="whitespace-pre-wrap">{turn.raw}</li>)}</ol></details> : null}
    {unresolved.map(turn => <div key={turn.position} className={`${primary ? 'm-4' : 'mt-3'} space-y-2 border-t border-border pt-3`}>
      <p className="text-folio-meta">This speech needs review before it can count as an answer. {turn.error}</p><p className="max-h-36 overflow-auto whitespace-pre-wrap text-folio-meta">{turn.raw}</p>
      {turn.asked ? <p className="text-folio-meta">Originally asked: {turn.asked}</p> : null}
      <button type="button" className={button} onClick={() => setRecovery({ position: turn.position, text: turn.raw, target: 'current' })}>Review this answer</button>
      <button type="button" className={`${button} ml-2`} disabled={busy} onClick={()=>void refreshReview()}>Refresh current interview state</button>
    </div>)}
    {recovery ? <div className={`${primary ? 'm-4' : 'mt-3'} space-y-2`}>
      <p className="text-folio-meta">Current question: {state?.snapshot?.currentQuestion?.text || 'No unanswered question. Review an earlier answer or continue in text.'}</p>
      <label htmlFor={`${fieldId}-recovery`} className="text-folio-meta">Answer to save · the original transcript is retained</label>
      <textarea id={`${fieldId}-recovery`} value={recovery.text} rows={5} onChange={event => setRecovery({ ...recovery, text: event.target.value })} className="w-full rounded-sm border border-border bg-surface-canvas p-2 text-folio-meta focus-visible:ring-2 focus-visible:ring-folio-gold" />
      <label className="block text-folio-meta">This belongs to <select value={recovery.target} onChange={event => setRecovery({ ...recovery, target: event.target.value as 'current' | 'previous' })} className="ml-2 border border-border bg-surface-canvas p-2"><option value="current">the current question</option><option value="previous">my previous answer</option></select></label>
      <button type="button" className={button} disabled={busy || !recovery.text.trim()} onClick={() => void recover()}>Save reviewed answer</button>
      <button type="button" className={`${button} ml-2`} disabled={busy} onClick={() => setRecovery(null)}>Keep for later</button>
    </div> : null}
    {state?.snapshot?.status === 'needs_review' && !unresolved.length ? <button type="button" className={`${button} mt-3`} disabled={busy} onClick={() => void control('retry')}>Retry next question</button> : null}
    {onOpenWorkspace ? <button type="button" className={`${button} mt-4 w-full border-transparent text-text-secondary underline underline-offset-4`} disabled={busy || awaitingReply || !!unresolved.length} onClick={() => void openWorkspace()}>Review saved answers</button> : null}
  </section>;
}

export default LiveInterviewPanel;
