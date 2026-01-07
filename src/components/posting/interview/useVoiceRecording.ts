"use client";

import { useState, useRef, useCallback } from "react";

export type RecordingStatus = "idle" | "recording" | "paused" | "transcribing";

interface UseVoiceRecordingOptions {
  onTranscriptionComplete?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecording({
  onTranscriptionComplete,
  onError,
}: UseVoiceRecordingOptions = {}) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setStatus("recording");
      setRecordingTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "audio/webm"; // Fallback

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        audioBlobRef.current = blob;
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      const errorMessage = "Failed to access microphone. Please check permissions.";
      setError(errorMessage);
      setStatus("idle");
      onError?.(errorMessage);
    }
  }, [onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [status]);

  const transcribeRecording = useCallback(
    async (projectId: string, questionId: string): Promise<string | null> => {
      if (!audioBlobRef.current) {
        return null;
      }

      setStatus("transcribing");
      setError(null);

      try {
        const formData = new FormData();
        formData.append("audio", audioBlobRef.current, "recording.webm");
        formData.append("questionId", questionId);

        const response = await fetch(
          `/api/posting/project/${projectId}/interview/transcribe`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Transcription failed");
        }

        const data = await response.json();
        const transcript = data.transcript || "";

        setStatus("idle");
        audioBlobRef.current = null;
        setRecordingTime(0);

        onTranscriptionComplete?.(transcript);
        return transcript;
      } catch (err) {
        console.error("Transcription error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Transcription failed";
        setError(errorMessage);
        setStatus("idle");
        onError?.(errorMessage);
        return null;
      }
    },
    [onTranscriptionComplete, onError]
  );

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("idle");
    setRecordingTime(0);
    audioBlobRef.current = null;
    chunksRef.current = [];
    setError(null);
  }, [status]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  return {
    status,
    recordingTime,
    error,
    formatTime,
    startRecording,
    stopRecording,
    transcribeRecording,
    cancelRecording,
    cleanup,
    isRecording: status === "recording",
    isTranscribing: status === "transcribing",
  };
}


