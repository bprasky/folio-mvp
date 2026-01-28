'use client';

import { cn } from '@/lib/utils';
import { VARIANT_LABELS, type ShareCardVariant, type ShareCardResult } from '@/lib/share-cards';

interface ShareCardPreviewProps {
  shareCards: ShareCardResult[];
  selectedVariant: ShareCardVariant;
  onVariantChange: (variant: ShareCardVariant) => void;
}

const variants: ShareCardVariant[] = ['instagram_post', 'instagram_story', 'linkedin', 'twitter'];

export function ShareCardPreview({
  shareCards,
  selectedVariant,
  onVariantChange,
}: ShareCardPreviewProps) {
  const selectedCard = shareCards.find((card) => card.variant === selectedVariant);

  return (
    <div>
      {/* Variant tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {variants.map((variant) => {
          const card = shareCards.find((c) => c.variant === variant);
          return (
            <button
              key={variant}
              onClick={() => onVariantChange(variant)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                selectedVariant === variant
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/80',
                !card && 'opacity-50'
              )}
            >
              {VARIANT_LABELS[variant]}
            </button>
          );
        })}
      </div>

      {/* Card preview */}
      <div className="flex justify-center items-center bg-[var(--bg-elevated)] rounded-xl p-4 min-h-[300px]">
        {selectedCard ? (
          <div
            className={cn(
              'bg-white rounded-lg shadow-lg overflow-hidden',
              selectedVariant === 'instagram_story' && 'w-[180px] h-[320px]',
              selectedVariant === 'instagram_post' && 'w-[250px] h-[250px]',
              selectedVariant === 'linkedin' && 'w-[300px] h-[157px]',
              selectedVariant === 'twitter' && 'w-[300px] h-[169px]'
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedCard.imageUrl}
              alt={`Share card - ${VARIANT_LABELS[selectedVariant]}`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="text-center text-[var(--text-secondary)]">
            <p className="mb-2">No card generated for this variant</p>
            <button
              onClick={() => onVariantChange(selectedVariant)}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Generate now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
