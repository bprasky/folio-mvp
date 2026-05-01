'use client';

import { useState, useRef, useEffect } from 'react';
import type { PromptedQuestion } from './PromptedQuestionCard';

interface PromptedAnswerModalProps {
  question: PromptedQuestion;
  onSubmit: (questionId: string, answerText: string) => Promise<void>;
  onClose: () => void;
}

export function PromptedAnswerModal({
  question,
  onSubmit,
  onClose,
}: PromptedAnswerModalProps) {
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!answerText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(question.id, answerText.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-[20px] bg-white shadow-2xl overflow-hidden">
        {submitted ? (
          /* Success state */
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-folio-text-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-folio-text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3
              className="text-lg text-folio-text-primary mb-2"
              style={{ fontFamily: 'var(--font-headline)' }}
            >
              Answer saved
            </h3>
            <p
              className="text-sm text-folio-text-secondary mb-6"
            >
              Your response has been added to your profile.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-folio-text-primary text-surface-ground text-sm font-medium hover:bg-[#3D3632] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Answer form */
          <>
            {/* Question */}
            <div className="p-6 pb-0">
              <p
                className="text-[17px] leading-relaxed text-folio-text-secondary"
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontStyle: 'italic',
                  fontWeight: 400,
                }}
              >
                &ldquo;{question.questionText}&rdquo;
              </p>
            </div>

            {/* Text area */}
            <div className="p-6">
              <textarea
                ref={textareaRef}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="A few sentences is perfect..."
                rows={5}
                className="w-full resize-none rounded-lg border border-[rgba(139,129,120,0.2)] bg-surface-ground p-4 text-[15px] text-folio-text-primary placeholder:text-folio-text-tertiary focus:border-[rgba(139,129,120,0.4)] focus:outline-none focus:ring-0 transition-colors"
              />

              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-6 pb-6">
              <button
                onClick={onClose}
                className="text-sm text-folio-text-secondary hover:text-folio-text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!answerText.trim() || submitting}
                className="px-6 py-2.5 rounded-lg bg-folio-text-primary text-surface-ground text-sm font-medium hover:bg-[#3D3632] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
