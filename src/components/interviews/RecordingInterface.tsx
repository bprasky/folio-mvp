"use client";

import { useState, useRef, useEffect } from "react";
import { supportsInterviewRecording, RECORDER_MIME, INTERVIEW_MIME, MAX_INTERVIEW_BYTES } from '@/lib/interviews/format';
import { Button } from "@/components/ui/button";
import { Mic, Square, Upload, Loader2 } from "lucide-react";

interface RecordingInterfaceProps {
  interviewId: string;
  onUploadComplete?: () => void;
}

type RecordingStatus = "idle" | "recording" | "paused" | "recorded" | "uploading" | "uploaded";

export function RecordingInterface({ interviewId, onUploadComplete }: RecordingInterfaceProps) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setError(null);
      if (!supportsInterviewRecording(typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder)) {
        setError('This browser cannot record WebM/Opus audio. Please use a browser with WebM/Opus recording support.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: RECORDER_MIME,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: INTERVIEW_MIME });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus("recorded");
      };

      mediaRecorder.start();
      setStatus("recording");
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      console.error("Error starting recording:", err);
      setError("Failed to access microphone. Please check permissions.");
      setStatus("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    if (!audioBlob.size || audioBlob.size > MAX_INTERVIEW_BYTES) {
      setError('Please record nonempty audio under 4 MiB.');
      return;
    }

    setStatus("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch(`/api/interviews/${interviewId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      await response.json();
      setStatus("uploaded");
      onUploadComplete?.();
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("recorded");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-8">
      {/* Question Display Area - Large, Editorial */}
      <div className="w-full max-w-2xl text-center">
        <div className="text-4xl font-light text-folio-text-primary leading-relaxed mb-4">
          Tell us about your design process
        </div>
        <div className="text-lg text-folio-text-secondary font-light">
          Share your thoughts on materials, decisions, and the story behind this project
        </div>
      </div>

      {/* Recording Status */}
      <div className="flex flex-col items-center space-y-4">
        {status === "recording" && (
          <div className="flex items-center space-x-3 text-red-600">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <span className="text-2xl font-mono">{formatTime(recordingTime)}</span>
          </div>
        )}

        {status === "recorded" && audioUrl && (
          <div className="flex items-center space-x-3 text-folio-text-secondary">
            <span className="text-sm">Recording complete: {formatTime(recordingTime)}</span>
          </div>
        )}

        {status === "uploaded" && (
          <div className="flex items-center space-x-3 text-green-600">
            <span className="text-sm">✓ Uploaded — ready to process</span>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm text-center max-w-md">{error}</div>
        )}
      </div>

      {/* Audio Playback */}
      {audioUrl && status !== "uploading" && status !== "uploaded" && (
        <div className="w-full max-w-md">
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="w-full"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-4">
        {status === "idle" && (
          <Button
            onClick={startRecording}
            size="lg"
            className="px-8 py-6 text-lg rounded-full"
          >
            <Mic className="mr-2 h-5 w-5" />
            Start Recording
          </Button>
        )}

        {status === "recording" && (
          <Button
            onClick={stopRecording}
            size="lg"
            variant="destructive"
            className="px-8 py-6 text-lg rounded-full"
          >
            <Square className="mr-2 h-5 w-5" />
            Stop Recording
          </Button>
        )}

        {status === "recorded" && (
          <>
            <Button
              onClick={() => {
                setStatus("idle");
                setAudioBlob(null);
                setAudioUrl(null);
                setRecordingTime(0);
                if (audioUrl) {
                  URL.revokeObjectURL(audioUrl);
                }
              }}
              variant="outline"
              size="lg"
              className="px-8 py-6 text-lg rounded-full"
            >
              Record Again
            </Button>
            <Button
              onClick={handleUpload}
              size="lg"
              className="px-8 py-6 text-lg rounded-full"
            >
              <Upload className="mr-2 h-5 w-5" />
              Upload & Process
            </Button>
          </>
        )}

        {status === "uploading" && (
          <Button size="lg" disabled className="px-8 py-6 text-lg rounded-full">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Uploading...
          </Button>
        )}

        {status === "uploaded" && (
          <Button
            onClick={() => window.location.reload()}
            size="lg"
            className="px-8 py-6 text-lg rounded-full"
          >
            View Status
          </Button>
        )}
      </div>
    </div>
  );
}

