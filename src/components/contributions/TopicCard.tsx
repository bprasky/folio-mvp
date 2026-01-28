'use client';

import { cn } from '@/lib/utils';
import type { ArticleTopicWithStats } from '@/lib/contributions/types';

interface TopicCardProps {
  topic: ArticleTopicWithStats;
  onContribute?: () => void;
  className?: string;
}

export function TopicCard({ topic, onContribute, className }: TopicCardProps) {
  const hasContributed = !!topic.userContribution;
  const progress = Math.min(100, (topic.contributionCount / topic.targetContributions) * 100);

  // Format target date
  const targetDateLabel = topic.targetPublishDate
    ? new Date(topic.targetPublishDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-subtle)] bg-white p-5 transition-all',
        'hover:shadow-md hover:border-[var(--border-default)]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <h3 className="folio-h3 text-[var(--text-primary)] mb-1">
            {topic.title}
          </h3>
          <div className="flex items-center gap-2 folio-meta text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {topic.contributionCount} voice{topic.contributionCount !== 1 ? 's' : ''}
            </span>
            {targetDateLabel && (
              <>
                <span>&middot;</span>
                <span>Publishing {targetDateLabel}</span>
              </>
            )}
          </div>
        </div>

        {/* Category badge */}
        <span className="px-2 py-1 rounded-full text-xs bg-[var(--bg-elevated)] text-[var(--text-secondary)] capitalize">
          {topic.category}
        </span>
      </div>

      {/* Prompt question */}
      <p className="folio-body text-[var(--text-secondary)] mb-4 line-clamp-2">
        &ldquo;{topic.promptQuestion}&rdquo;
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 folio-meta text-[var(--text-secondary)]">
          <span>{topic.designerCount}D / {topic.vendorCount}V / {topic.individualCount}I</span>
          <span>{Math.round(progress)}% to goal</span>
        </div>
      </div>

      {/* CTA */}
      {hasContributed ? (
        <button
          disabled
          className="w-full py-2.5 px-4 rounded-lg bg-emerald-50 text-emerald-700 font-medium text-sm cursor-default"
        >
          Contributed
        </button>
      ) : (
        <button
          onClick={onContribute}
          className="w-full py-2.5 px-4 rounded-lg bg-[var(--accent)] text-white font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors"
        >
          Add Your Voice
        </button>
      )}
    </div>
  );
}
