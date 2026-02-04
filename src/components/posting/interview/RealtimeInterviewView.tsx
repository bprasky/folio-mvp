'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Pause, Play, StopCircle, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RealtimeInterviewViewProps {
  projectId: string;
  projectName: string;
  onComplete: (sessionId: string) => void;
  onSwitchToText: () => void;
}

type InterviewState =
  | 'connecting'
  | 'greeting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'completed';

interface Segment {
  id: string;
  role: 'designer' | 'ai';
  content: string;
  timestamp: number;
  extractedQuote?: string;
}

interface DataMessage {
  type: string;
  state?: InterviewState;
  text?: string;
  segment?: Segment;
  extraction?: {
    pullQuote?: string;
    productMentions?: string[];
    theme?: string;
    mood?: string;
  };
  error?: string;
}

function StateIndicator({ state }: { state: InterviewState }) {
  const config = {
    connecting: { label: 'Connecting...', color: 'text-stone-500', bg: 'bg-stone-100' },
    greeting: { label: 'Starting', color: 'text-amber-600', bg: 'bg-amber-100' },
    listening: { label: 'Listening', color: 'text-green-600', bg: 'bg-green-100' },
    processing: { label: 'Processing', color: 'text-amber-600', bg: 'bg-amber-100' },
    speaking: { label: 'Sofia speaking', color: 'text-amber-600', bg: 'bg-amber-100' },
    paused: { label: 'Paused', color: 'text-stone-500', bg: 'bg-stone-100' },
    completed: { label: 'Complete', color: 'text-green-600', bg: 'bg-green-100' },
  }[state];

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${config.color} ${config.bg}`}
    >
      {config.label}
    </span>
  );
}

export function RealtimeInterviewView({
  projectId,
  projectName,
  onComplete,
  onSwitchToText,
}: RealtimeInterviewViewProps) {
  const [state, setState] = useState<InterviewState>('connecting');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [extractedQuotes, setExtractedQuotes] = useState<string[]>([]);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize session
  useEffect(() => {
    initializeSession();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const initializeSession = async () => {
    try {
      abortControllerRef.current = new AbortController();

      // Create session
      const res = await fetch('/api/interview/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const { sessionId: newSessionId, roomName, livekitUrl } = await res.json();
      setSessionId(newSessionId);

      // Note: In production, you would connect to LiveKit here
      // For now, we'll simulate the connection and use polling
      // This is because LiveKit requires a browser with WebRTC support
      // and specific SDK initialization

      // Simulate connection success after a brief delay
      setTimeout(() => {
        setState('greeting');

        // Simulate the greeting
        setTimeout(() => {
          setSegments([
            {
              id: 'greeting-1',
              role: 'ai',
              content: `Hi! I've been looking at ${projectName}—the attention to detail is really striking. I'd love to hear about what drew you to this particular approach. What was the initial vision that shaped this project?`,
              timestamp: Date.now(),
            },
          ]);
          setState('listening');
        }, 2000);
      }, 1500);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Failed to initialize session:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to connect. Please try again or switch to text mode.'
      );
    }
  };

  const handleDataReceived = useCallback((message: DataMessage) => {
    switch (message.type) {
      case 'state_change':
        if (message.state) {
          setState(message.state);
        }
        break;
      case 'transcript':
        if (message.text) {
          setCurrentTranscript(message.text);
        }
        break;
      case 'segment':
        if (message.segment) {
          setSegments((prev) => [...prev, message.segment!]);
          setCurrentTranscript('');
        }
        break;
      case 'extraction':
        if (message.extraction?.pullQuote) {
          setExtractedQuotes((prev) => [...prev, message.extraction!.pullQuote!]);
        }
        break;
      case 'complete':
        setState('completed');
        if (sessionId) {
          onComplete(sessionId);
        }
        break;
      case 'error':
        setError(message.error || 'An error occurred');
        break;
    }
  }, [sessionId, onComplete]);

  const togglePause = useCallback(() => {
    if (state === 'paused') {
      // Resume
      setState('listening');
      // In production, send resume message via LiveKit
    } else if (state === 'listening') {
      // Pause
      setState('paused');
      // In production, send pause message via LiveKit
    }
  }, [state]);

  const endInterview = useCallback(async () => {
    if (!sessionId) return;

    try {
      // In production, this would send an end message via LiveKit
      // For now, we'll directly update the session status
      setState('completed');
      onComplete(sessionId);
    } catch (err) {
      console.error('Failed to end interview:', err);
    }
  }, [sessionId, onComplete]);

  const cleanup = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop =
        transcriptContainerRef.current.scrollHeight;
    }
  }, [segments, currentTranscript]);

  return (
    <div className="flex flex-col h-[70vh] max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <div>
          <h3 className="font-medium text-stone-800">{projectName}</h3>
          <p className="text-xs text-stone-500">Live Interview</p>
        </div>
        <div className="flex items-center gap-2">
          <StateIndicator state={state} />
          {extractedQuotes.length > 0 && (
            <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
              {extractedQuotes.length} quote
              {extractedQuotes.length !== 1 ? 's' : ''} captured
            </span>
          )}
        </div>
      </div>

      {/* Transcript Area */}
      <div
        ref={transcriptContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50"
      >
        <AnimatePresence mode="popLayout">
          {segments.map((segment) => (
            <motion.div
              key={segment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                segment.role === 'designer' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`
                max-w-[80%] p-4 rounded-2xl
                ${
                  segment.role === 'designer'
                    ? 'bg-stone-100 text-stone-800'
                    : 'bg-amber-50 text-stone-800 border border-amber-100'
                }
              `}
              >
                {segment.role === 'ai' && (
                  <p className="text-xs font-medium text-amber-600 mb-1">Sofia</p>
                )}
                <p className="text-sm">{segment.content}</p>
                {segment.extractedQuote && (
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <span>&#10022;</span> Quote captured
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Live Transcript */}
        {currentTranscript && state === 'listening' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end"
          >
            <div className="max-w-[80%] p-4 rounded-2xl bg-stone-200/50 text-stone-600">
              <p className="text-sm">{currentTranscript}</p>
              <span className="inline-block w-2 h-4 bg-stone-400 animate-pulse ml-1" />
            </div>
          </motion.div>
        )}

        {/* Processing Indicator */}
        {state === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Sofia is thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={onSwitchToText}
            className="text-sm text-red-600 hover:text-red-700 underline"
          >
            Switch to text mode
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 bg-white">
        <button
          onClick={onSwitchToText}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Switch to text mode
        </button>

        <div className="flex items-center gap-3">
          {/* Pause/Resume */}
          <button
            onClick={togglePause}
            disabled={state === 'connecting' || state === 'completed'}
            className={`
              p-3 rounded-full transition-colors
              ${
                state === 'paused'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {state === 'paused' ? (
              <Play className="w-5 h-5" />
            ) : (
              <Pause className="w-5 h-5" />
            )}
          </button>

          {/* Microphone Indicator */}
          <div
            className={`
            p-4 rounded-full transition-all
            ${
              state === 'listening'
                ? 'bg-green-100 text-green-600 ring-4 ring-green-100 animate-pulse'
                : state === 'speaking'
                ? 'bg-amber-100 text-amber-600'
                : 'bg-stone-100 text-stone-400'
            }
          `}
          >
            {state === 'listening' || state === 'paused' ? (
              state === 'paused' ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </div>

          {/* End Interview */}
          <button
            onClick={endInterview}
            disabled={state === 'connecting' || segments.length < 2}
            className="
              px-4 py-2 bg-stone-800 text-white rounded-lg
              hover:bg-stone-700 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            <StopCircle className="w-4 h-4" />
            End Interview
          </button>
        </div>
      </div>
    </div>
  );
}
