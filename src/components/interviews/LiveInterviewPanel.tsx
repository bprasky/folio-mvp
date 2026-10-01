'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import type { LiveAdapterSnapshot, LiveSource } from '@/lib/live-interview/adapter-types';
import type { LiveTurn } from '@/lib/live-interview/turns';
import { checkCaptureReady, discardStoredCaptures, purgeExpiredCaptures, retryStoredCaptures, startCreatorCapture, type CaptureHandle, type CaptureState } from '@/lib/live-interview/capture';

interface LiveState {
  id: string; status: string; snapshot?: Omit<LiveAdapterSnapshot, 'state'>; turns?: LiveTurn[]; notice?: string;
  join?: { url: string; token: string; conversationId: string }; recordingEnabled?: boolean;
}
interface Props { source: LiveSource; onCanonicalChange?: (snapshot?: Omit<LiveAdapterSnapshot,'state'>) => void; onActiveChange?: (active: boolean) => void; beforeStart?: () => Promise<void>; selectedImageId?:string|null; onSessionChange?:(id:string)=>void }
type Mode = 'none' | 'audio' | 'video';
const button = 'rounded-sm border border-border px-3 py-2 text-folio-meta font-medium hover:bg-surface-ground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:cursor-not-allowed disabled:opacity-50';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function liveRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), signal: AbortSignal.timeout(120_000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || 'The live interview is unavailable. Your saved answers are unchanged.');
  return result as T;
}

/** Embedded in each existing interview; never starts a paid call on mount. */
export function LiveInterviewPanel({ source, onCanonicalChange, onActiveChange, beforeStart, selectedImageId, onSessionChange }: Props) {
  const fieldId = useId();
  const sourceKey = JSON.stringify(source);
  const [available, setAvailable] = useState(false);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [mode, setMode] = useState<Mode>('none');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [state, setState] = useState<LiveState | null>(null);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<CaptureState | null>(null);
  const [recordingMessage, setRecordingMessage] = useState('');
  const [recovery, setRecovery] = useState<{ position: number; text: string; target: 'current' | 'previous' } | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const stateRef = useRef<LiveState | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<CaptureHandle | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const ending = useRef(false);
  const startKey = useRef<string | null>(null);
  const eventTail = useRef(Promise.resolve());
  const eventBacklog = useRef(0);
  const eventKeys = useRef(new Set<string>());
  const callbacks = useRef({ onCanonicalChange, onActiveChange, onSessionChange });
  callbacks.current = { onCanonicalChange, onActiveChange, onSessionChange };
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const lastVersion = useRef('');
  const joinedAt = useRef(0);
  const mountedSource = useRef(sourceKey);

  const setCurrent = useCallback((next: LiveState) => {
    stateRef.current = { ...stateRef.current, ...next };
    if (!mounted.current) return;
    setState(stateRef.current);
    callbacks.current.onSessionChange?.(next.id);
    // Only an opaque Folio identifier is retained; joining secrets stay in memory.
    try { sessionStorage.setItem(`folio.live.session.${mountedSource.current}`, next.id); } catch { /* server reservation still prevents duplicate calls */ }
    const version = next.snapshot?.version;
    if (version && version !== lastVersion.current) {
      lastVersion.current = version; callbacks.current.onCanonicalChange?.(next.snapshot);
    }
  }, []);
  const progress = useCallback((next: CaptureState, message?: string) => {
    if (mounted.current) { setRecording(next); setRecordingMessage(message || ''); }
  }, []);
  const release = useCallback(async () => {
    const call = callRef.current; callRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (call) { await call.leave().catch(() => {}); await call.destroy().catch(() => {}); }
    if (mounted.current) { setActive(false); setCamera(false); }
    callbacks.current.onActiveChange?.(false);
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
      if (id) setCurrent(await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(id)}`, { action }));
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'The end request could not be confirmed. Retry End; automatic session cleanup remains active.');
    } finally {
      await releasing; await finishing;
      ending.current = false; inFlight.current = false;
      if (mounted.current) setBusy(false);
      callbacks.current.onCanonicalChange?.(stateRef.current?.snapshot);
    }
  }, [progress, release, setCurrent]);
  const endRef = useRef(end); endRef.current = end;

  useEffect(() => {
    let cancelled = false;
    setAvailable(false);
    void purgeExpiredCaptures().catch(()=>{});
    void (async () => {
      if (mountedSource.current !== sourceKey) {
        await endRef.current('end');
        if (cancelled) return;
        mountedSource.current = sourceKey; startKey.current = null; stateRef.current = null; captureRef.current = null;
        setState(null); setMode('none'); setConsent(false); setRecording(null); setRecovery(null);
      }
      void liveRequest<{ enabled?: boolean; available?: boolean; recordingEnabled?: boolean }>(`/api/live-interviews?source=${encodeURIComponent(sourceKey)}`)
        .then(result => { if (!cancelled) { setAvailable(result.enabled === true || result.available === true); setRecordingAvailable(result.recordingEnabled === true); } })
        .catch(() => {});
      try {
        const savedId = sessionStorage.getItem(`folio.live.session.${sourceKey}`);
        if (savedId) void liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(savedId)}`)
          .then(next => { if (!cancelled) setCurrent(next); }).catch(() => {});
      } catch { /* saving interview progress does not depend on browser storage */ }
    })();
    return () => { cancelled = true; };
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
      mounted.current = false; window.removeEventListener('pagehide', unload);
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
    eventTail.current = eventTail.current.then(async () => {
      if (!sessionId) return;
      // Retry the same provider sequence; a new receipt would misattribute old speech.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const next = await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(sessionId)}`, { action: 'event', event });
          if (next.id) setCurrent(next);
          return;
        } catch {
          if (attempt === 2) { if (mounted.current) setError('Speech confirmation failed. The call is paused; review the retained turn before continuing.'); void endRef.current('pause'); }
        }
      }
    }).catch(() => {}).finally(() => { eventBacklog.current--; });
  }, [setCurrent]);

  const start = async () => {
    if (inFlight.current || callRef.current) return;
    if (mode !== 'none' && !consent) { setError('Confirm recording consent before starting.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    let startedSessionId: string | undefined;
    try {
      await beforeStart?.();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('A secure browser with microphone access is required. You can continue in text.');
      if (mode !== 'none') await checkCaptureReady(mode);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      if (!stream.getAudioTracks().some(track => track.readyState === 'live')) throw new Error('The microphone is not ready. Check its permission and try again.');
      const Daily = (await import('@daily-co/daily-js')).default;
      if (!mounted.current) { await release(); return; }
      // Preserve this key after an ambiguous provider-create result. Never blind retry a paid call.
      startKey.current ??= crypto.randomUUID();
      const next = await liveRequest<LiveState>('/api/live-interviews', { source: JSON.parse(sourceKey), requestId: startKey.current,
        mode, consentVersion: '2026-10-01', microphoneReady: true, selectedImageId });
      startedSessionId = next.id;
      setCurrent(next);
      if (!mounted.current) { await endRef.current('end'); return; }
      if (!next.join?.url || !next.join.token) throw new Error(next.notice || 'The session is being reconciled. Retry with this same request; no second call will be requested.');
      const call = Daily.createCallObject({ audioSource: stream.getAudioTracks()[0], videoSource: false, startAudioOff: true, startVideoOff: true });
      callRef.current = call;
      call.on('participant-joined', syncTracks).on('participant-updated', syncTracks).on('participant-left', syncTracks)
        .on('track-started', syncTracks).on('track-stopped', syncTracks)
        .on('app-message', event => providerEvent(event?.data, next.join!.conversationId))
        .on('error', () => { if (mounted.current) setError('The live connection failed. Saved answers are retained.'); void endRef.current('pause'); });
      await call.join({ url: next.join.url, token: next.join.token });
      if (!mounted.current) { await endRef.current('end'); return; }
      joinedAt.current = performance.now();
      setActive(true); callbacks.current.onActiveChange?.(true); setCamera(false);
      if (mode !== 'none') {
        if (next.recordingEnabled === false) throw new Error('Recording could not start. This session has been stopped; choose another mode.');
        captureRef.current = await startCreatorCapture({ sessionId: next.id, stream, mode: 'audio', offsetMs: Math.round(performance.now() - joinedAt.current), onProgress: progress });
      } else { captureRef.current = null; setRecording(null); }
      call.setLocalAudio(true); setMuted(false); syncTracks();
      captureRef.current?.setMuted(false);
      startKey.current = null;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'The live interview could not start.';
      if (startedSessionId) await endRef.current('end');
      else await release();
      if (mounted.current) setError(message);
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };

  const control = async (action: 'skip' | 'retry') => {
    if (!state?.id || busy) return;
    if (active) await end('switch_to_text');
    setBusy(true); setError('');
    try { setCurrent(await liveRequest<LiveState>(`/api/live-interviews/${encodeURIComponent(state.id)}`, { action: 'control',
      command: { action, requestId: crypto.randomUUID(), questionId: state.snapshot?.currentQuestion?.id } })); }
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
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } } });
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

  if (!available && !state) return null;
  const unresolved = state?.turns?.filter(turn => turn.status === 'needs_review') || [];
  const savedTurns = state?.turns?.filter(turn => turn.status === 'saved') || [];
  return <section aria-label="Live interview" className="w-full min-w-0 rounded-sm border border-border bg-surface-canvas p-4 text-folio-body text-text-primary">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-folio-ui font-semibold">Folio Interviewer</h3><p className="text-folio-meta text-text-secondary">AI interviewer · your saved Folio questions</p></div>
      <span className="text-folio-meta" role="status">{active ? 'Live' : busy ? 'Connecting…' : 'Optional'}</span>
    </div>
    {!active ? <div className="mt-3 space-y-3">
      <p className="text-folio-meta">Speak naturally while you explore your work. Your answers return to this interview.</p>
      <fieldset disabled={busy} className="space-y-2"><legend className="text-folio-meta font-medium">Before you start</legend>
        {([['none', 'Interview without saving audio or video'], ['audio', 'Save my voice for media'], ['video', 'Save my voice and camera for media']] as const).map(([value, label]) =>
          <label key={value} className="flex items-start gap-2 text-folio-meta"><input type="radio" name={`${fieldId}-mode`} value={value} checked={mode === value} disabled={value !== 'none' && !recordingAvailable}
            onChange={() => { setMode(value); setConsent(false); }} className="mt-1 accent-folio-gold" /><span>{label}</span></label>)}
      </fieldset>
      <p className="text-folio-meta text-text-secondary">Live speech is processed and transcribed by our interview providers in every mode. Provider processing may include retention. Camera starts off; voice and camera mode lets you turn it on during the interview.</p>
      {mode !== 'none' ? <label className="flex items-start gap-2 text-folio-meta"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-folio-gold" />
        <span>I consent to private capture and processing of my {mode === 'video' ? 'voice and camera footage' : 'voice'} for media preparation. Publishing requires my separate approval. My camera footage is not sent to the live interviewer.</span></label> : null}
      {mode !== 'none' ? <p className="text-folio-meta text-text-secondary">Upload recovery temporarily stores recording chunks on this device. Capture stops when pending data reaches 25 MiB, retaining the final recorder data. Uploaded chunks are removed; recovery expires after 24 hours and is cleared when Folio next opens. You can discard retained device recordings below.</p> : null}
      <button type="button" className={button} disabled={busy || (mode !== 'none' && !consent)} onClick={() => void start()}>{busy ? 'Preparing live interview…' : state ? 'Resume live interview' : 'Start live interview'}</button>
      {state?.id && !['ended', 'ENDED', 'expired', 'EXPIRED'].includes(state.status) ? <button type="button" className={`${button} ml-2`} disabled={busy} onClick={() => void end('end')}>End saved live session</button> : null}
    </div> : null}
    <div className={active ? 'mt-3 space-y-3' : 'hidden'}>
      <div className="flex items-end gap-3">
        <video ref={remoteVideo} muted autoPlay playsInline aria-label="Folio AI interviewer" className="aspect-video w-40 max-w-full rounded-sm bg-surface-ground object-cover" />
        {camera ? <video ref={localVideo} muted autoPlay playsInline aria-label="Your private camera preview" className="aspect-video w-24 rounded-sm bg-surface-ground object-cover" /> : null}
        <audio ref={remoteAudio} autoPlay />
      </div>
      {audioBlocked ? <button type="button" className={button} onClick={() => { void remoteAudio.current?.play().then(() => setAudioBlocked(false)).catch(() => setError('Audio playback is blocked. Check browser sound permissions.')); }}>Play interviewer audio</button> : null}
      {state?.snapshot?.currentQuestion ? <p className="text-folio-ui">{state.snapshot.currentQuestion.text}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} aria-pressed={muted} onClick={() => { const next = !muted; streamRef.current?.getAudioTracks().forEach(track=>{track.enabled=!next;}); callRef.current?.setLocalAudio(!next); captureRef.current?.setMuted(next); setMuted(next); }}>{muted ? 'Unmute microphone' : 'Mute microphone'}</button>
        {mode === 'video' && recording === 'recording' ? <button type="button" className={button} disabled={busy} onClick={() => void toggleCamera()}>{camera ? 'Turn camera off' : 'Turn camera on for recording'}</button> : null}
        <button type="button" className={button} aria-pressed={captions} onClick={() => setCaptions(value => !value)}>Captions</button>
        {recording === 'recording' ? <button type="button" className={button} disabled={busy} onClick={() => {
          void captureRef.current?.stop().catch(() => progress('incomplete', 'Retry the final recording upload.'));
          streamRef.current?.getVideoTracks().forEach(track => track.stop()); setCamera(false);
        }}>Stop recording</button> : null}
        <button type="button" className={button} disabled={busy} onClick={() => void end('pause')}>Pause</button>
        <button type="button" className={button} disabled={busy} onClick={() => void end('end')}>End</button>
        <button type="button" className={button} disabled={busy} onClick={() => void end('switch_to_text')}>Switch to text</button>
        <button type="button" className={button} disabled={busy || !!unresolved.length} onClick={() => void control('skip')}>Skip question</button>
      </div>
      {captions && caption ? <div className="max-h-32 overflow-auto whitespace-pre-wrap text-folio-meta" aria-live="polite"><p className="text-text-secondary">Live captions · awaiting canonical save</p>{caption}</div> : null}
    </div>
    <div className="mt-3 space-y-2 text-folio-meta" aria-live="polite">
      {state ? <p>{savedTurns.length} {savedTurns.length === 1 ? 'answer' : 'answers'} saved in this live session.{state.turns?.some(turn => turn.status === 'awaiting_final' || turn.status === 'saving') ? ' Latest speech is awaiting save.' : ''}</p> : null}
      {recording ? <p>{recording === 'recording' ? `Recording your ${camera ? 'voice and camera' : 'voice'}` : recording === 'uploading' ? 'Finishing private upload…' : recording === 'processing' ? 'Private recording is processing' : 'Recording needs attention'}{recordingMessage ? ` — ${recordingMessage}` : ''}</p> : null}
      {recording === 'incomplete' ? <button type="button" className={button} onClick={() => void retryRecording()}>Retry recording upload</button> : null}
      {state?.id && !active && !recording ? <button type="button" className={button} onClick={() => void retryRecording()}>Recover retained recording uploads</button> : null}
      {state?.id && !active ? <button type="button" className={button} onClick={() => { void discardStoredCaptures(state.id).then(()=>{captureRef.current=null;setRecording(null);setRecordingMessage('Device recovery deleted. Uploaded sources and saved answers are unchanged.');}).catch(()=>setError('Device recovery could not be discarded. Sign in as the interview owner and retry.')); }}>Discard device recording recovery</button> : null}
      {state?.notice || state?.snapshot?.notice ? <p>{state.notice || state.snapshot?.notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
    {savedTurns.length ? <details className="mt-3 text-folio-meta"><summary className="cursor-pointer focus-visible:ring-2 focus-visible:ring-folio-gold">Saved transcript</summary>
      <ol className="mt-2 max-h-48 space-y-2 overflow-auto">{savedTurns.map(turn => <li key={turn.position} className="whitespace-pre-wrap">{turn.raw}</li>)}</ol></details> : null}
    {unresolved.map(turn => <div key={turn.position} className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-folio-meta">This speech needs review before it can count as an answer. {turn.error}</p><p className="max-h-36 overflow-auto whitespace-pre-wrap text-folio-meta">{turn.raw}</p>
      {turn.asked ? <p className="text-folio-meta">Originally asked: {turn.asked}</p> : null}
      <button type="button" className={button} onClick={() => setRecovery({ position: turn.position, text: turn.raw, target: 'current' })}>Review this answer</button>
      <button type="button" className={`${button} ml-2`} disabled={busy} onClick={()=>void refreshReview()}>Refresh current interview state</button>
    </div>)}
    {recovery ? <div className="mt-3 space-y-2">
      <p className="text-folio-meta">Current question: {state?.snapshot?.currentQuestion?.text || 'No unanswered question. Review an earlier answer or continue in text.'}</p>
      <label htmlFor={`${fieldId}-recovery`} className="text-folio-meta">Answer to save · the original transcript is retained</label>
      <textarea id={`${fieldId}-recovery`} value={recovery.text} rows={5} onChange={event => setRecovery({ ...recovery, text: event.target.value })} className="w-full rounded-sm border border-border bg-surface-canvas p-2 text-folio-meta focus-visible:ring-2 focus-visible:ring-folio-gold" />
      <label className="block text-folio-meta">This belongs to <select value={recovery.target} onChange={event => setRecovery({ ...recovery, target: event.target.value as 'current' | 'previous' })} className="ml-2 border border-border bg-surface-canvas p-2"><option value="current">the current question</option><option value="previous">my previous answer</option></select></label>
      <button type="button" className={button} disabled={busy || !recovery.text.trim()} onClick={() => void recover()}>Save reviewed answer</button>
      <button type="button" className={`${button} ml-2`} disabled={busy} onClick={() => setRecovery(null)}>Keep for later</button>
    </div> : null}
    {state?.snapshot?.status === 'needs_review' && !unresolved.length ? <button type="button" className={`${button} mt-3`} disabled={busy} onClick={() => void control('retry')}>Retry next question</button> : null}
  </section>;
}

export default LiveInterviewPanel;
