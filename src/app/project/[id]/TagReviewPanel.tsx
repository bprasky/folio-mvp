'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { X, Check, Tag, CircleSlash } from 'lucide-react';
import { markImageReviewed } from '@/app/actions/projectImages';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';

interface ReviewImage {
  id: string;
  url: string;
  name?: string | null;
  inclusion?: 'INCLUDED' | 'EXCLUDED';
  tagState?: 'UNREVIEWED' | 'REVIEWED';
  tags: Array<{ id: string }>;
}

interface TagReviewPanelProps {
  open: boolean;
  onClose: () => void;
  images: ReviewImage[];
  /** Open the manual click-to-tag surface. */
  onTagPhoto: () => void;
  onChanged: () => void;
}

/**
 * Tag review (spec 20 §3d). Drives every INCLUDED photo to REVIEWED: confirm
 * the photo's tags, or declare "No products in this photo". The tags gate
 * flips complete only when no INCLUDED photo is left UNREVIEWED.
 *
 * AI-suggested tags from a finish-schedule import are confirmed in the import
 * flow's existing Confirm/Correct/Dismiss queue; this panel is where the
 * designer signs off each photo.
 */
export default function TagReviewPanel({
  open,
  onClose,
  images,
  onTagPhoto,
  onChanged,
}: TagReviewPanelProps) {
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const photos = images.filter(img => !isDocumentImage(img.name) && img.inclusion !== 'EXCLUDED');
  const unreviewed = photos.filter(img => img.tagState !== 'REVIEWED');

  const review = (imageId: string) =>
    startTransition(async () => {
      try {
        await markImageReviewed({ imageId });
        onChanged();
      } catch (err) {
        console.error('[TagReviewPanel] mark reviewed failed:', err);
        alert(err instanceof Error ? err.message : 'Something went wrong');
      }
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-backdrop" onClick={onClose} />

      <div className="relative warm-mesh rounded-2xl bg-surface-ground border border-folio-border-subtle shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="relative z-[1] p-7 pb-4 shrink-0">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-headline italic text-3xl text-folio-text-primary">
            Confirm your tags
          </h2>
          <p className="folio-body text-folio-text-secondary mt-1.5">
            We found these. Confirm, fix, or remove each one.
          </p>
        </div>

        <div className="relative z-[1] px-7 pb-7 overflow-y-auto space-y-3">
          {unreviewed.length === 0 ? (
            <div className="text-center py-10">
              <Check className="w-10 h-10 text-[var(--folio-gold)] mx-auto mb-3" />
              <p className="folio-ui text-folio-text-primary">Every photo is reviewed.</p>
            </div>
          ) : (
            unreviewed.map(img => {
              const tagCount = img.tags.length;
              return (
                <div
                  key={img.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-surface-canvas border border-folio-border-subtle"
                >
                  <div className="relative w-20 h-16 shrink-0 rounded-lg overflow-hidden bg-stone-100">
                    <Image
                      src={img.url}
                      alt={img.name || 'Photo'}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="folio-meta text-folio-text-secondary">
                      {tagCount > 0
                        ? `${tagCount} ${tagCount === 1 ? 'product' : 'products'} tagged`
                        : 'No products tagged yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={onTagPhoto}
                      className="inline-flex items-center gap-1.5 px-3 py-2 folio-meta font-medium text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Tag products
                    </button>
                    {tagCount > 0 ? (
                      <button
                        onClick={() => review(img.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 folio-meta font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Confirm
                      </button>
                    ) : (
                      <button
                        onClick={() => review(img.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 folio-meta font-medium text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        <CircleSlash className="w-3.5 h-3.5" />
                        No products in this photo
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
