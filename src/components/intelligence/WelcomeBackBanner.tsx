'use client';

import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ProjectEngagement {
  views: number;
  saves: number;
  daysSinceVisit: number;
  topInterest?: {
    productTagId: string;
    productName: string;
    count: number;
  };
}

interface WelcomeBackBannerProps {
  projectId: string;
  projectTitle: string;
  engagement: ProjectEngagement;
  onAddQuote: (params: {
    question: string;
    answer: string;
    productTagId?: string;
  }) => Promise<void>;
  onDismiss?: () => void;
  className?: string;
}

/**
 * WelcomeBackBanner Component
 *
 * Shows designers engagement metrics when they return to their projects
 * and prompts them to add supplemental quotes about popular products.
 *
 * Part of the Intelligence System - Layer 6: Designer Ecosystem
 *
 * See docs/12_INTELLIGENCE_SYSTEM.md for full specification.
 */
export function WelcomeBackBanner({
  projectId,
  projectTitle,
  engagement,
  onAddQuote,
  onDismiss,
  className,
}: WelcomeBackBannerProps) {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Don't show if visited recently
  if (engagement.daysSinceVisit < 1) {
    return null;
  }

  const handleSubmit = async () => {
    if (!answer.trim() || !engagement.topInterest) return;

    setIsSubmitting(true);
    try {
      await onAddQuote({
        question: `What drew you to the ${engagement.topInterest.productName}?`,
        answer: answer.trim(),
        productTagId: engagement.topInterest.productTagId,
      });
      setSubmitted(true);
      setShowForm(false);
    } catch (error) {
      console.error('Failed to add quote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'glass-overlay rounded-xl p-6',
        'border border-[var(--border-subtle)]',
        'shadow-[var(--neu-raised)]',
        'relative',
        className
      )}
    >
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Header */}
      <h3 className="font-medium text-lg text-[var(--text-primary)] mb-2">
        Welcome back to {projectTitle}
      </h3>

      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Since your last visit:
      </p>

      {/* Engagement stats */}
      <ul className="text-sm space-y-1.5 mb-4">
        <li className="flex items-center gap-2 text-[var(--text-primary)]">
          <span className="text-[var(--accent)]">👁</span>
          <span>{engagement.views.toLocaleString()} people viewed your project</span>
        </li>
        <li className="flex items-center gap-2 text-[var(--text-primary)]">
          <span className="text-[var(--accent)]">💾</span>
          <span>{engagement.saves.toLocaleString()} people saved it</span>
        </li>
        {engagement.topInterest && (
          <li className="flex items-center gap-2 text-[var(--text-primary)]">
            <span className="text-[var(--accent)]">✨</span>
            <span>
              {engagement.topInterest.count.toLocaleString()} people were interested in{' '}
              <span className="font-medium">{engagement.topInterest.productName}</span>
            </span>
          </li>
        )}
      </ul>

      {/* Quote prompt */}
      {engagement.topInterest && !submitted && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          {!showForm ? (
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                Want to add a note about the {engagement.topInterest.productName}?
              </p>
              <Button
                variant="ridge"
                size="sm"
                onClick={() => setShowForm(true)}
              >
                Add a note
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
                What drew you to the {engagement.topInterest.productName}?
              </p>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Share the story behind this piece..."
                className={cn(
                  'w-full p-3 rounded-lg text-sm',
                  'bg-[var(--bg-sunken)]',
                  'border border-[var(--border-subtle)]',
                  'text-[var(--text-primary)]',
                  'placeholder:text-[var(--text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30',
                  'resize-none'
                )}
                rows={3}
              />
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!answer.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Note'}
                </Button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setAnswer('');
                  }}
                  className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success message */}
      {submitted && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Note added! It will appear alongside the product.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
interface WelcomeBackInlineProps {
  projectTitle: string;
  engagement: ProjectEngagement;
  onViewDetails: () => void;
  className?: string;
}

export function WelcomeBackInline({
  projectTitle,
  engagement,
  onViewDetails,
  className,
}: WelcomeBackInlineProps) {
  if (engagement.daysSinceVisit < 1) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-[var(--bg-elevated)] rounded-lg p-3',
        'border border-[var(--border-subtle)]',
        'flex items-center justify-between gap-4',
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">
          <span className="font-medium">{projectTitle}</span>
          {' · '}
          <span className="text-[var(--text-secondary)]">
            {engagement.views} views, {engagement.saves} saves since last visit
          </span>
        </p>
      </div>

      <button
        onClick={onViewDetails}
        className="shrink-0 text-sm text-[var(--accent)] hover:underline"
      >
        View details
      </button>
    </div>
  );
}

export default WelcomeBackBanner;
