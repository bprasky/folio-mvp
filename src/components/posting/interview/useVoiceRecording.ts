"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingStatus = "idle" | "recording" | "paused" | "transcribing";

interface UseVoiceRecordingOptions {
  onTranscriptionComplete?: (transcript: string, metadata?: { recordingId?: string }) => void;
  onError?: (error: string) => void;
}

/** Existing microphone/transcription transport shared by both interview UIs. */
export function useVoiceRecording({ onTranscriptionComplete, onError }: UseVoiceRecordingOptions = {}) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const stoppedRef = useRef<Promise<void> | null>(null);
  const resolveStopRef = useRef<(() => void) | null>(null);
  const epochRef = useRef(0);
  const transcriptionRef = useRef<AbortController | null>(null);

  const formatTime = useCallback((seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, []);
  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    epochRef.current += 1;
    transcriptionRef.current?.abort();
    transcriptionRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    clearTimer();
    audioBlobRef.current = null;
    chunksRef.current = [];
    resolveStopRef.current?.();
    resolveStopRef.current = null;
    stoppedRef.current = null;
    mediaRecorderRef.current = null;
  }, [clearTimer]);

  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    cleanup();
    const epoch = epochRef.current;
    setError(null);
    setHasRecording(false);
    setStatus("recording");
    setRecordingTime(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // The dialog may have closed while the permission request was visible.
      if (epoch !== epochRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/ogg", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      stoppedRef.current = new Promise<void>(resolve => { resolveStopRef.current = resolve; });
      recorder.ondataavailable = event => {
        if (epoch === epochRef.current && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (epoch !== epochRef.current) return;
        audioBlobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setHasRecording(audioBlobRef.current.size > 0);
        setStatus("paused");
        clearTimer();
        resolveStopRef.current?.();
        resolveStopRef.current = null;
      };
      recorder.start();
      timerRef.current = setInterval(() => setRecordingTime(value => value + 1), 1000);
    } catch {
      if (epoch !== epochRef.current) return;
      cleanup();
      const message = "Failed to access microphone. Please check permissions.";
      setError(message); setStatus("idle"); onError?.(message);
    }
  }, [cleanup, clearTimer, onError]);

  // Wait for the recorder's final data event; a timer is not a reliable flush.
  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    clearTimer();
    await stoppedRef.current;
  }, [clearTimer]);

  const transcribeRecording = useCallback(async (projectId: string, questionId: string): Promise<string | null> => {
    await stopRecording();
    const blob = audioBlobRef.current;
    if (!blob?.size || transcriptionRef.current) return null;
    const epoch = epochRef.current;
    const controller = new AbortController();
    transcriptionRef.current = controller;
    setStatus("transcribing"); setError(null);
    try {
      const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const data = new FormData();
      data.append("audio", blob, `recording.${extension}`);
      data.append("questionId", questionId);
      const response = await fetch(`/api/posting/project/${encodeURIComponent(projectId)}/interview/transcribe`, {
        method: "POST", body: data, signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Transcription failed");
      if (typeof result.transcript !== "string") throw new Error("No transcription was returned. Please retry.");
      if (epoch !== epochRef.current) return null;
      audioBlobRef.current = null;
      setHasRecording(false); setStatus("idle"); setRecordingTime(0);
      onTranscriptionComplete?.(result.transcript, { recordingId: typeof result.recordingId === 'string' ? result.recordingId : undefined });
      return result.transcript;
    } catch (err) {
      if (epoch !== epochRef.current) return null;
      const message = err instanceof Error ? err.message : "Transcription failed";
      // Keep the original audio in memory so retry does not require re-recording.
      setError(message); setStatus("idle"); onError?.(message);
      return null;
    } finally {
      if (transcriptionRef.current === controller) transcriptionRef.current = null;
    }
  }, [stopRecording, onTranscriptionComplete, onError]);

  const cancelRecording = useCallback(() => {
    cleanup(); setStatus("idle"); setRecordingTime(0); setHasRecording(false); setError(null);
  }, [cleanup]);

  return { status, recordingTime, error, hasRecording, formatTime, startRecording, stopRecording,
    transcribeRecording, cancelRecording, cleanup, isRecording: status === "recording", isTranscribing: status === "transcribing" };
}
