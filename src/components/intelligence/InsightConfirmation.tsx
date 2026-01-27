'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { TasteInferenceData } from '@/lib/intelligence/types';

interface InsightConfirmationProps {
  inference: TasteInferenceData;
  onConfirm: () => void;
  onDeny: () => void;
  onSkip: () => void;
  className?: string;
  isLoading?: boolean;
}

/**
 * InsightConfirmation Component
 *
 * Displays a detected taste pattern and allows the user to confirm, deny, or skip.
 * Part of the Intelligence System - Layer 3: Insight Confirmation
 *
 * See docs/12_INTELLIGENCE_SYSTEM.md for full specification.
 */
export function InsightConfirmation({
  inference,
  onConfirm,
  onDeny,
  onSkip,
  className,
  isLoading = false,
}: InsightConfirmationProps) {
  // Format the attribute for display
  const formatAttribute = (attr: string) => {
    return attr
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get icon based on attribute type
  const getAttributeIcon = () => {
    switch (inference.attributeType) {
      case 'color':
        return '🎨';
      case 'material':
        return '✨';
      case 'shape':
        return '◐';
      case 'style':
        return '🏛';
      default:
        return '✦';
    }
  };

  return (
    <div
      className={cn(
        'glass-panel p-4 rounded-xl',
        'border border-[var(--border-subtle)]',
        'shadow-[var(--neu-raised)]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{getAttributeIcon()}</span>
        <p className="text-sm text-[var(--text-secondary)]">
          We noticed something
        </p>
      </div>

      {/* Main insight */}
      <p className="font-medium text-[var(--text-primary)] mb-1">
        You seem drawn to{' '}
        <span className="text-[var(--accent)]">
          {formatAttribute(inference.attribute)}
        </span>
      </p>

      {/* Evidence */}
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {inference.evidence}
      </p>

      {/* Confidence indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${inference.confidence * 100}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          {Math.round(inference.confidence * 100)}% confident
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="accent"
          size="sm"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          Exactly!
        </Button>
        <Button
          variant="ridge"
          size="sm"
          onClick={onDeny}
          disabled={isLoading}
        >
          Not really
        </Button>
        <button
          onClick={onSkip}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

/**
 * InsightConfirmationBanner
 *
 * A compact banner version for inline display (e.g., after save #10)
 */
interface InsightConfirmationBannerProps extends InsightConfirmationProps {
  onDismiss?: () => void;
}

export function InsightConfirmationBanner({
  inference,
  onConfirm,
  onDeny,
  onSkip,
  onDismiss,
  className,
  isLoading = false,
}: InsightConfirmationBannerProps) {
  const formatAttribute = (attr: string) => {
    return attr
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div
      className={cn(
        'bg-[var(--bg-elevated)] rounded-lg p-3',
        'border border-[var(--border-subtle)]',
        'flex items-center gap-3',
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">
          You seem drawn to{' '}
          <span className="font-medium text-[var(--accent)]">
            {formatAttribute(inference.attribute)}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-2.5 py-1 text-xs font-medium text-white bg-[var(--accent)] rounded-md hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
        >
          Yes!
        </button>
        <button
          onClick={onDeny}
          disabled={isLoading}
          className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          No
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * TasteDiscoveryMilestone
 *
 * Shown at save milestones (5, 10, 15, 25) with appropriate messaging
 */
interface TasteDiscoveryMilestoneProps {
  milestone: 5 | 10 | 15 | 25;
  savesCount: number;
  styleName?: string;
  className?: string;
  onDismiss?: () => void;
}

export function TasteDiscoveryMilestone({
  milestone,
  savesCount,
  styleName,
  className,
  onDismiss,
}: TasteDiscoveryMilestoneProps) {
  const getMessage = () => {
    switch (milestone) {
      case 5:
        return {
          emoji: '🌱',
          title: 'Keep saving!',
          subtitle: "We're learning your taste.",
        };
      case 10:
        return {
          emoji: '✨',
          title: 'Patterns emerging',
          subtitle: "We're starting to see your style.",
        };
      case 15:
        return {
          emoji: '🎯',
          title: 'Your taste is taking shape',
          subtitle: "Cross-patterns detected!",
        };
      case 25:
        return {
          emoji: '🏆',
          title: styleName ? `Your style: ${styleName}` : 'Style unlocked!',
          subtitle: styleName
            ? 'Your taste profile is ready.'
            : 'View your taste profile.',
        };
    }
  };

  const message = getMessage();

  return (
    <div
      className={cn(
        'bg-gradient-to-r from-[var(--accent)]/10 to-transparent',
        'rounded-lg p-4 border border-[var(--accent)]/20',
        'relative overflow-hidden',
        className
      )}
    >
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="flex items-center gap-3">
        <span className="text-2xl">{message.emoji}</span>
        <div>
          <p className="font-medium text-[var(--text-primary)]">
            {message.title}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {message.subtitle}
          </p>
        </div>
      </div>

      {/* Progress bar to next milestone */}
      {milestone < 25 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>{savesCount} saves</span>
            <span>Next at {milestone === 5 ? 10 : milestone === 10 ? 15 : 25}</span>
          </div>
          <div className="h-1 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500"
              style={{
                width: `${(savesCount / (milestone === 5 ? 10 : milestone === 10 ? 15 : 25)) * 100}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default InsightConfirmation;
