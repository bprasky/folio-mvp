'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RidgeCard } from '@/components/ui/ridge-card';
import { cn } from '@/lib/utils';
import type { ArticleTopicWithStats, ContributionType } from '@/lib/contributions/types';

interface ContributionModalProps {
  topic: ArticleTopicWithStats;
  userRole: string;
  onSubmit: (content: string, type: ContributionType) => Promise<void>;
  onClose: () => void;
}

const MAX_CHARS = 500;

// Determine default contribution type based on user role
function getDefaultType(role: string): ContributionType {
  switch (role) {
    case 'VENDOR':
      return 'EXPERTISE';
    case 'INDIVIDUAL':
      return 'CONSUMER_VOICE';
    case 'DESIGNER':
    case 'ARCHITECT':
    case 'BUILDER':
    default:
      return 'QUICK_TAKE';
  }
}

export function ContributionModal({
  topic,
  userRole,
  onSubmit,
  onClose,
}: ContributionModalProps) {
  const [content, setContent] = useState('');
  const [type] = useState<ContributionType>(getDefaultType(userRole));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || content.length > MAX_CHARS) return;

    setLoading(true);
    setError(null);

    try {
      await onSubmit(content.trim(), type);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }, [content, type, onSubmit]);

  const charsRemaining = MAX_CHARS - content.length;
  const isOverLimit = charsRemaining < 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <RidgeCard padding="none" className="max-w-lg w-full overflow-hidden">
        {success ? (
          // Success state
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-600"
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
            <h2 className="folio-h2 mb-2">Your voice has been added</h2>
            <p className="folio-body text-[var(--text-secondary)] mb-6">
              We&apos;ll notify you when it&apos;s published.
            </p>
            <Button variant="accent" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-[var(--border-subtle)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="folio-h2 mb-1">{topic.title}</h2>
                  <div className="flex items-center gap-2 folio-meta text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {topic.contributionCount} voice{topic.contributionCount !== 1 ? 's' : ''} so far
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-[var(--text-secondary)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Question */}
              <div className="mb-4">
                <label className="block folio-meta text-[var(--text-secondary)] mb-2">
                  The question:
                </label>
                <p className="folio-body text-[var(--text-primary)] font-medium">
                  &ldquo;{topic.promptQuestion}&rdquo;
                </p>
              </div>

              {/* Textarea */}
              <div className="mb-4">
                <label className="block folio-meta text-[var(--text-secondary)] mb-2">
                  Your perspective:
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your thoughts in 2-3 sentences..."
                  className={cn(
                    'ridge-input w-full px-4 py-3 min-h-[120px] resize-none',
                    isOverLimit && 'border-red-500 focus:ring-red-500'
                  )}
                  disabled={loading}
                />
                <div className="flex justify-between mt-2 folio-meta">
                  <span className={cn(
                    'text-[var(--text-secondary)]',
                    isOverLimit && 'text-red-500'
                  )}>
                    {charsRemaining} characters remaining
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="folio-meta text-[var(--text-secondary)] mb-4">
                Your response may be quoted in the published article.
              </p>

              {/* Error */}
              {error && (
                <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex justify-end gap-3">
              <Button variant="ridge" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={handleSubmit}
                disabled={loading || !content.trim() || isOverLimit}
              >
                {loading ? 'Submitting...' : 'Add Your Voice'}
              </Button>
            </div>
          </>
        )}
      </RidgeCard>
    </div>
  );
}
