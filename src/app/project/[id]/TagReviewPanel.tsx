'use client';
import { SpotlightSelections } from '@/components/spotlight/PrivateSpotlightInterview';

import { useMemo, useTransition } from 'react';
import Image from 'next/image';
import { X, Check, Tag, CircleSlash, Layers } from 'lucide-react';
import { setImageNoProducts, markRoomNoProducts } from '@/app/actions/projectImages';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';

interface ReviewImage {
  id: string;
  url: string;
  name?: string | null;
  roomId?: string | null;
  inclusion?: 'INCLUDED' | 'EXCLUDED';
  noProducts?: boolean;
  tags: Array<{ id: string }>;
}

interface RoomLite {
  id: string;
  name: string;
}

interface TagReviewPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  images: ReviewImage[];
  rooms: RoomLite[];
  /** Open the manual click-to-tag surface. */
  onTagPhoto: () => void;
  onChanged: () => void;
}

const UNROOMED = '__unroomed__';

/**
 * Tag review (spec 20 §3d, revised). Review state is derived — a photo with a
 * confirmed tag already passes the gate and never appears here. This panel
 * resolves only the tail of untagged photos: tag them, or declare them
 * product-free (per photo, or a per-room sweep). Every action is reversible
 * (a swept photo can be reopened from the media grid).
 */
export default function TagReviewPanel({
  open,
  onClose,
  projectId,
  images,
  rooms,
  onTagPhoto,
  onChanged,
}: TagReviewPanelProps) {
  const [isPending, startTransition] = useTransition();

  const roomName = useMemo(() => {
    const map = new Map(rooms.map(r => [r.id, r.name]));
    return (roomId?: string | null) => (roomId && map.get(roomId)) || 'Not in a room';
  }, [rooms]);

  // Remaining = INCLUDED photos with no tags and not yet declared product-free.
  const remaining = images.filter(
    img =>
      !isDocumentImage(img.name) &&
      img.inclusion !== 'EXCLUDED' &&
      img.tags.length === 0 &&
      !img.noProducts,
  );

  // Group the remaining photos by room so the sweep can be room-scoped.
  const groups = useMemo(() => {
    const byRoom = new Map<string, ReviewImage[]>();
    for (const img of remaining) {
      const key = img.roomId ?? UNROOMED;
      const list = byRoom.get(key) ?? [];
      list.push(img);
      byRoom.set(key, list);
    }
    return Array.from(byRoom.entries());
  }, [remaining]);

  if (!open) return null;

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        onChanged();
      } catch (err) {
        console.error('[TagReviewPanel] action failed:', err);
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
            Tagged photos are done. These have no products yet — tag them, or mark them as
            product-free.
          </p>
        </div>

        <div className="relative z-[1] px-7 pb-7 overflow-y-auto space-y-6">
          <SpotlightSelections projectId={projectId} />
          {remaining.length === 0 ? (
            <div className="text-center py-10">
              <Check className="w-10 h-10 text-[var(--folio-gold)] mx-auto mb-3" />
              <p className="folio-ui text-folio-text-primary">Every photo is resolved.</p>
            </div>
          ) : (
            groups.map(([roomKey, roomImages]) => (
              <section key={roomKey} className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="folio-ui font-semibold text-folio-text-secondary">
                    {roomName(roomKey === UNROOMED ? null : roomKey)}
                    <span className="ml-2 text-folio-text-tertiary">{roomImages.length} left</span>
                  </h3>
                  {roomKey !== UNROOMED && (
                    <button
                      onClick={() => run(() => markRoomNoProducts({ projectId, roomId: roomKey }))}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 folio-meta font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors disabled:opacity-50"
                      title={`The remaining ${roomImages.length} photos have no products to tag`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Mark remaining {roomImages.length} as no products
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {roomImages.map(img => (
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
                      <p className="min-w-0 flex-1 folio-meta text-folio-text-secondary">
                        No products tagged yet
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={onTagPhoto}
                          className="inline-flex items-center gap-1.5 px-3 py-2 folio-meta font-medium text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Tag products
                        </button>
                        <button
                          onClick={() => run(() => setImageNoProducts({ imageId: img.id, value: true }))}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-2 folio-meta font-medium text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          <CircleSlash className="w-3.5 h-3.5" />
                          No products in this photo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
