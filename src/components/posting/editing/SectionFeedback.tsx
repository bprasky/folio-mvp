'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, Undo2 } from 'lucide-react';

interface SectionFeedbackProps {
  projectId: string;
  chapterIndex: number;
  hasHistory: boolean;
  onRegenerated: () => void;
}

export default function SectionFeedback({
  projectId,
  chapterIndex,
  hasHistory,
  onRegenerated,
}: SectionFeedbackProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show undo button briefly after regeneration
  useEffect(() => {
    if (showUndo) {
      const timer = setTimeout(() => setShowUndo(false), 15000);
      return () => clearTimeout(timer);
    }
  }, [showUndo]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/sections/${chapterIndex}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Regeneration failed');
      }
      setFeedback('');
      setFeedbackOpen(false);
      setShowUndo(true);
      onRegenerated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleUndo() {
    setUndoing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/sections/${chapterIndex}/undo`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Undo failed');
      }
      setShowUndo(false);
      onRegenerated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Feedback toggle */}
        <button
          onClick={() => setFeedbackOpen(!feedbackOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 folio-meta font-medium rounded-md border transition-colors ${
            feedbackOpen
              ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-folio-border-subtle text-folio-text-tertiary hover:text-folio-text-secondary hover:border-folio-text-tertiary'
          }`}
          title="Give feedback and regenerate this section"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Regenerate Section
        </button>

        {/* Undo button (transient, after regeneration) */}
        {(showUndo || hasHistory) && (
          <button
            onClick={handleUndo}
            disabled={undoing}
            className="flex items-center gap-1 px-2.5 py-1 folio-meta font-medium text-folio-text-tertiary hover:text-folio-text-primary border border-folio-border-subtle rounded-md transition-colors disabled:opacity-50"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {undoing ? 'Undoing...' : 'Undo'}
          </button>
        )}
      </div>

      {/* Feedback input */}
      {feedbackOpen && (
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g., Make it more casual, focus on the material choices"
            className="flex-1 border border-folio-border-subtle rounded-md px-3 py-1.5 folio-meta focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-surface-canvas text-folio-text-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !regenerating) handleRegenerate();
              if (e.key === 'Escape') setFeedbackOpen(false);
            }}
            autoFocus
          />
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 folio-meta font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      )}

      {error && (
        <p className="folio-meta text-red-600">{error}</p>
      )}
    </div>
  );
}
