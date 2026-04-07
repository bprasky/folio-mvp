'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

interface PendingTagCardProps {
  tag: PendingTag;
  onConfirm: () => void;
  onCorrect: (productId: string) => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function PendingTagCard({
  tag,
  onConfirm,
  onCorrect,
  onDismiss,
  isLoading,
}: PendingTagCardProps) {
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const imageUrl = tag.tempImageUrl || '';

  return (
    <div className="bg-surface-canvas border border-folio-border-subtle rounded-lg overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Image preview with tag position indicator */}
        {imageUrl && (
          <div className="w-full sm:w-48 h-36 relative flex-shrink-0">
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            <div
              className="absolute w-4 h-4 bg-surface-canvas border-2 border-folio-text-primary rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
              style={{
                left: `${tag.x * 100}%`,
                top: `${tag.y * 100}%`,
              }}
            />
          </div>
        )}

        {/* Tag details */}
        <div className="flex-1 p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-folio-text-primary truncate">{tag.description}</p>
              <p className="text-sm text-folio-text-tertiary">{tag.category}</p>
            </div>
            <ConfidenceBadge level={tag.attributionConfidence} className="ml-2 flex-shrink-0" />
          </div>

          {/* Suggested product */}
          {tag.topSuggestion && (
            <div className="flex items-center gap-3 p-3 bg-surface-ground rounded-lg mt-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-folio-text-primary truncate">
                  {tag.topSuggestion.productName}
                </p>
                <p className="text-xs text-folio-text-tertiary truncate">
                  {tag.topSuggestion.vendorName}
                  {tag.topSuggestion.price && ` - ${tag.topSuggestion.price}`}
                </p>
              </div>
              <a
                href={tag.topSuggestion.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] hover:underline flex-shrink-0"
              >
                View
              </a>
            </div>
          )}

          {/* Other suggestions */}
          {tag.suggestions.length > 1 && (
            <button
              onClick={() => setShowAllSuggestions(!showAllSuggestions)}
              className="text-xs text-folio-text-tertiary hover:text-folio-text-secondary mt-2"
            >
              {showAllSuggestions ? 'Hide' : 'Show'} {tag.suggestions.length - 1} more suggestion(s)
            </button>
          )}

          {showAllSuggestions && (
            <div className="mt-2 space-y-2">
              {tag.suggestions.slice(1).map((suggestion, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-surface-ground rounded-lg text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{suggestion.productName}</p>
                    <p className="text-xs text-folio-text-tertiary truncate">{suggestion.vendorName}</p>
                  </div>
                  <ConfidenceBadge level={suggestion.confidence} />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="default"
              onClick={onConfirm}
              disabled={!tag.topSuggestion || isLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // For now, just show an alert - in production, this would open a product search
                const productId = window.prompt('Enter product ID to correct with:');
                if (productId) {
                  onCorrect(productId);
                }
              }}
              disabled={isLoading}
            >
              Correct
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              disabled={isLoading}
              className="text-folio-text-tertiary hover:text-folio-text-secondary"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
