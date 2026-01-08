'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { PendingTagCard } from './PendingTagCard';
import { ConfidenceBadge } from './ConfidenceBadge';

interface ProductAttribution {
  productUrl: string;
  vendorName: string;
  productName: string;
  price?: string;
  confidence: string;
  matchReason: string;
}

interface PendingTag {
  id: string;
  tempImageUrl: string | null;
  projectImageId: string | null;
  x: number;
  y: number;
  description: string;
  category: string;
  searchQuery: string;
  suggestions: ProductAttribution[];
  topSuggestion: ProductAttribution | null;
  detectionConfidence: string;
  attributionConfidence: string | null;
  status: string;
}

interface VerificationQueueProps {
  sessionId: string;
  pendingTags: PendingTag[];
  total: number;
  confidenceBreakdown: Record<string, number>;
  onRefresh: () => void;
  onComplete: () => void;
}

export function VerificationQueue({
  sessionId,
  pendingTags,
  total,
  confidenceBreakdown,
  onRefresh,
  onComplete,
}: VerificationQueueProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [processingTagId, setProcessingTagId] = useState<string | null>(null);

  const reviewed = total - pendingTags.length;
  const highConfidenceCount = confidenceBreakdown['high'] || 0;
  const lowConfidenceCount = confidenceBreakdown['low'] || 0;

  const verifyTag = useCallback(
    async (tagId: string, action: 'confirm' | 'correct' | 'dismiss', productId?: string) => {
      setProcessingTagId(tagId);
      try {
        const response = await fetch(`/api/import/pending-tag/${tagId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, productId }),
        });

        if (!response.ok) {
          throw new Error('Failed to verify tag');
        }

        onRefresh();
      } catch (error) {
        console.error('Verification error:', error);
        alert('Failed to verify tag. Please try again.');
      } finally {
        setProcessingTagId(null);
      }
    },
    [onRefresh]
  );

  const batchVerify = useCallback(
    async (action: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/import/${sessionId}/batch-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          throw new Error('Failed to batch verify');
        }

        const result = await response.json();
        alert(`Processed ${result.processed} tags (${result.confirmed} confirmed, ${result.dismissed} dismissed)`);
        onRefresh();
      } catch (error) {
        console.error('Batch verification error:', error);
        alert('Failed to batch verify. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, onRefresh]
  );

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif text-stone-900">Verify Product Tags</h2>
          <p className="text-sm text-stone-500">
            {reviewed} of {total} verified - {pendingTags.length} remaining
          </p>
        </div>

        {/* Completeness ring */}
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#e5e5e5"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#10b981"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(reviewed / total) * 176} 176`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">
              {total > 0 ? Math.round((reviewed / total) * 100) : 0}%
            </span>
          </div>
          <span className="text-sm text-stone-500">Completeness</span>
        </div>
      </div>

      {/* Quick actions */}
      {highConfidenceCount > 0 && (
        <GlassCard variant="subtle" padding="md" className="border-emerald-200 bg-emerald-50/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <ConfidenceBadge level="high" />
              <span className="text-emerald-700">
                {highConfidenceCount} high-confidence matches found
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => batchVerify('confirm_all_high_confidence')}
              disabled={isLoading}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            >
              Confirm All High-Confidence
            </Button>
          </div>
        </GlassCard>
      )}

      {lowConfidenceCount > 0 && (
        <GlassCard variant="subtle" padding="md" className="border-red-200 bg-red-50/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <ConfidenceBadge level="low" />
              <span className="text-red-700">
                {lowConfidenceCount} low-confidence matches need review
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => batchVerify('dismiss_all_low_confidence')}
              disabled={isLoading}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Dismiss All Low-Confidence
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Tag list */}
      {pendingTags.length > 0 ? (
        <div className="space-y-4">
          {pendingTags.map((tag) => (
            <PendingTagCard
              key={tag.id}
              tag={tag}
              onConfirm={() => verifyTag(tag.id, 'confirm')}
              onCorrect={(productId) => verifyTag(tag.id, 'correct', productId)}
              onDismiss={() => verifyTag(tag.id, 'dismiss')}
              isLoading={processingTagId === tag.id}
            />
          ))}
        </div>
      ) : (
        <GlassCard variant="subtle" padding="lg" className="text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
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
            <div>
              <h3 className="text-lg font-medium text-stone-900">All tags verified!</h3>
              <p className="text-stone-500">
                You&apos;ve reviewed all {total} detected products.
              </p>
            </div>
            <Button onClick={onComplete}>Complete Import</Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
