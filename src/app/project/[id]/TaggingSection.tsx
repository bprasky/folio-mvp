'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  FaTag,
  FaTrash,
  FaPen,
  FaCheck,
  FaTimes,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaRegClock,
} from 'react-icons/fa';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';
import { ProductTagPicker } from '@/components/project/ProductTagPicker';
import { ProductEditModal } from '@/components/project/ProductEditModal';

/** Tag rows carry the full product so the list can show name + category. */
type TagRow = {
  id: string;
  x: number;
  y: number;
  reviewedAt?: string | null;
  product?: {
    id: string;
    name: string;
    category?: string | null;
    imageUrl?: string | null;
    brand?: string | null;
    scrapeStatus?: string | null;
  } | null;
};

type Photo = {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
  roomId?: string | null;
  inclusion?: 'INCLUDED' | 'EXCLUDED';
  tags: TagRow[];
};

type Room = { id: string; name: string; type?: string | null };

/** An unplaced finish-schedule product awaiting placement on a photo. */
type SpecTag = {
  id: string;
  description: string;
  category: string | null;
  roomType: string | null;
  extractedVendor: string | null;
  extractedPrice: number | null;
  extractedSku: string | null;
  extractedDimensions: string | null;
  extractedMaterial: string | null;
  extractedProductUrl: string | null;
};

interface TaggingSectionProps {
  projectId: string;
  images: Photo[];
  rooms: Room[];
  isOwner: boolean;
  /** Refresh the project data after a write (router.refresh in the parent). */
  onChanged: () => void;
  /** Leave the tagging surface, back to the media workspace. */
  onExit?: () => void;
  /**
   * Hand a dropped finish-book file to the existing document-import pipeline
   * (PDF → spec extractor, PPTX → presentation importer, spreadsheet → the
   * finish-schedule call). When omitted, the fast-path drop stays inert.
   */
  onImportFinishBook?: (file: File) => void;
}

/**
 * TaggingSection — the inline manual tagging surface (spec: inline two-path).
 *
 * Renders directly on the media page: an interview-first lede, the (inert)
 * finish-book fast path, a divider, then photos grouped by room. Clicking a
 * photo expands it in place; the designer drops a single transient pin and
 * tags a product via the shared ProductTagPicker. Each photo's tags render in
 * a list *beside* the photo — never over it.
 */
export default function TaggingSection({
  projectId,
  images,
  rooms,
  isOwner,
  onChanged,
  onExit,
  onImportFinishBook,
}: TaggingSectionProps) {
  // Only one photo is in its working (expanded) state at a time.
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  // Product being edited/enriched (from a tag row, or the picker's reuse path).
  const [editState, setEditState] = useState<{ productId: string; tagId: string | null } | null>(null);

  // Finish-schedule products parsed but not yet placed on a photo, and the one
  // the designer is currently placing (click a photo to anchor it).
  const [unplaced, setUnplaced] = useState<SpecTag[]>([]);
  const [placingTag, setPlacingTag] = useState<SpecTag | null>(null);

  const refetchUnplaced = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pending-spec-tags`);
      if (res.ok) {
        const data = await res.json();
        setUnplaced(Array.isArray(data.tags) ? data.tags : []);
      }
    } catch {
      /* best-effort — the tray just stays as-is */
    }
  }, [projectId]);

  // Load on mount and whenever the project data refreshes (e.g. after an import
  // completes or a product is placed, which re-renders with new images).
  useEffect(() => {
    refetchUnplaced();
  }, [refetchUnplaced, images]);

  // Place the active finish-schedule product onto a photo at the given spot.
  const placeProduct = async (tagId: string, imageId: string, x: number, y: number) => {
    try {
      const res = await fetch(`/api/import/pending-tag/${tagId}/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, x, y }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Could not place that product.');
        return;
      }
      setPlacingTag(null);
      await refetchUnplaced();
      onChanged();
    } catch (err) {
      console.error('[TaggingSection] place error:', err);
    }
  };

  // Drop a parsed product we don't want to place.
  const dismissUnplaced = async (tagId: string) => {
    try {
      await fetch(`/api/import/pending-tag/${tagId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      });
      if (placingTag?.id === tagId) setPlacingTag(null);
      await refetchUnplaced();
    } catch (err) {
      console.error('[TaggingSection] dismiss error:', err);
    }
  };

  // Included portfolio photos only, grouped by room (uncategorized pinned top),
  // mirroring the room workspace so the two views stay consistent.
  const photos = images.filter(
    (img) => img.inclusion !== 'EXCLUDED' && !isDocumentImage(img.name ?? undefined),
  );
  const uncategorized = photos.filter((p) => !p.roomId);
  const roomBuckets = rooms
    .map((room) => ({ room, photos: photos.filter((p) => p.roomId === room.id) }))
    .filter((bucket) => bucket.photos.length > 0);

  const collapse = () => setActivePhotoId(null);

  // Confirm a tag — clears the deferred "needs confirm" state (reused picker can
  // create a pending product for flagged domains / bot-walled scrapes).
  const confirmTag = async (tagId: string) => {
    try {
      await fetch('/api/tag-product-to-image', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tagId, reviewed: true }),
      });
      onChanged();
    } catch (err) {
      console.error('[TaggingSection] confirm error:', err);
    }
  };

  // Leaving with tags still awaiting review drops the same inbox reminder the
  // modal surface did, so a deferred tag can't be silently forgotten.
  const handleExit = async () => {
    const pendingCount = photos.reduce(
      (n, p) => n + p.tags.filter((t) => t.product?.scrapeStatus != null && !t.reviewedAt).length,
      0,
    );
    if (pendingCount > 0) {
      try {
        await fetch('/api/notifications/tag-review-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
      } catch {
        /* best-effort — don't block leaving */
      }
    }
    onExit?.();
  };

  return (
    <div className="space-y-8">
      {/* Lede — interview-first: every tag gives the interview a real detail. */}
      <header className="space-y-2">
        {onExit && (
          <button
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 folio-meta text-folio-text-secondary hover:text-folio-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to your photos
          </button>
        )}
        <h2 className="font-headline italic text-3xl text-folio-text-primary">
          Tag the products in your rooms
        </h2>
        <p className="folio-body text-folio-text-secondary max-w-2xl">
          Every product you tag gives the interview a real detail to ask about — so the published
          piece comes back sharper. Untagged photos still publish; they just stay quiet.
        </p>
      </header>

      {/* Two-path shell — finish-book fast path + divider + tag-by-hand below. */}
      <FinishBookDropZone onFile={onImportFinishBook} />

      <div className="flex items-center gap-4" role="separator">
        <span className="h-px flex-1 bg-folio-border-subtle" />
        <span className="folio-meta text-folio-text-tertiary whitespace-nowrap">
          or tag by hand, room by room
        </span>
        <span className="h-px flex-1 bg-folio-border-subtle" />
      </div>

      {/* Products parsed from a finish schedule, waiting to be placed on a photo. */}
      {isOwner && unplaced.length > 0 && (
        <UnplacedTray
          tags={unplaced}
          placingId={placingTag?.id ?? null}
          onPlace={(tag) => setPlacingTag((cur) => (cur?.id === tag.id ? null : tag))}
          onDismiss={dismissUnplaced}
        />
      )}

      {/* Sticky prompt while placing a finish-schedule product. */}
      {placingTag && (
        <div className="sticky top-2 z-30 flex items-center gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2.5 shadow-sm">
          <FaMapMarkerAlt className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
          <p className="folio-meta text-folio-text-primary flex-1 min-w-0">
            Placing <span className="font-semibold">{placingTag.description}</span>
            {placingTag.roomType ? ` · suggested room: ${placingTag.roomType}` : ''} — open a photo
            and click where it goes.
          </p>
          <button
            onClick={() => setPlacingTag(null)}
            className="folio-meta font-medium text-folio-text-secondary hover:text-folio-text-primary whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="folio-body text-folio-text-secondary text-center py-10">
          Upload photos first, then come back to tag the products in them.
        </p>
      ) : (
        <div className="space-y-10">
          {/* Uncategorized — pinned to the top when present */}
          {uncategorized.length > 0 && (
            <section className="space-y-4">
              <RoomLabel name="Not in a room yet" count={uncategorized.length} />
              <div className="space-y-4">
                {uncategorized.map((photo) => (
                  <PhotoTagger
                    key={photo.id}
                    projectId={projectId}
                    photo={photo}
                    isOwner={isOwner}
                    active={activePhotoId === photo.id}
                    onActivate={() => setActivePhotoId(photo.id)}
                    onCollapse={collapse}
                    onChanged={onChanged}
                    onEditProduct={(productId, tagId) => setEditState({ productId, tagId })}
                    onConfirm={confirmTag}
                    placing={placingTag}
                    onPlace={(imageId, x, y) =>
                      placingTag && placeProduct(placingTag.id, imageId, x, y)
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* One group per room with photos */}
          {roomBuckets.map(({ room, photos: roomPhotos }) => {
            const tagged = roomPhotos.filter((p) => p.tags.length > 0).length;
            return (
              <section key={room.id} className="space-y-4">
                <RoomLabel name={room.name} count={roomPhotos.length} tagged={tagged} />
                <div className="space-y-4">
                  {roomPhotos.map((photo) => (
                    <PhotoTagger
                      key={photo.id}
                      projectId={projectId}
                      photo={photo}
                      isOwner={isOwner}
                      active={activePhotoId === photo.id}
                      onActivate={() => setActivePhotoId(photo.id)}
                      onCollapse={collapse}
                      onChanged={onChanged}
                      onEditProduct={(productId, tagId) => setEditState({ productId, tagId })}
                      onConfirm={confirmTag}
                      placing={placingTag}
                      onPlace={(imageId, x, y) =>
                        placingTag && placeProduct(placingTag.id, imageId, x, y)
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Shared product editor — enrich/correct a tagged product. */}
      {editState && (
        <ProductEditModal
          productId={editState.productId}
          tagId={editState.tagId}
          onClose={() => setEditState(null)}
          onSaved={async (tagId) => {
            // Editing a deferred tag's product counts as confirming it.
            if (tagId) await confirmTag(tagId);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/**
 * The finish-book fast path. Accepts a finish schedule by drag-and-drop or file
 * picker and hands it to the existing document-import pipeline (PDF spec
 * extractor / presentation importer / finish-schedule call) via `onFile`.
 * Falls back to an inert affordance when no handler is wired.
 */
function FinishBookDropZone({ onFile }: { onFile?: (file: File) => void }) {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file && onFile) onFile(file);
  };

  if (!onFile) {
    return (
      <div
        aria-disabled="true"
        className="relative rounded-2xl border-2 border-dashed border-folio-border-subtle bg-surface-ground/60 px-6 py-8 text-center opacity-70 cursor-not-allowed select-none"
      >
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-surface-canvas border border-folio-border-subtle px-2.5 py-1 folio-meta text-folio-text-tertiary">
          <FaRegClock className="w-3 h-3" />
          Coming soon
        </span>
        <Sparkles className="w-8 h-8 mx-auto mb-3 text-[var(--folio-gold-ornament)]" />
        <h3 className="folio-ui font-semibold text-folio-text-primary">Tag everything at once</h3>
        <p className="folio-meta text-folio-text-secondary mt-1 max-w-md mx-auto">
          Drop your finish book and we&apos;ll pull the products out for you.
        </p>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        take(e.dataTransfer.files);
      }}
      className={`relative rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${
        isOver
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-folio-border-subtle bg-surface-ground/60 hover:border-[var(--accent)]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.pptx,.ppt,.xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.currentTarget.value = '';
        }}
      />
      <Sparkles className="w-8 h-8 mx-auto mb-3 text-[var(--folio-gold-ornament)]" />
      <h3 className="folio-ui font-semibold text-folio-text-primary">Tag everything at once</h3>
      <p className="folio-meta text-folio-text-secondary mt-1 max-w-md mx-auto">
        {isOver
          ? 'Drop to import your finish book…'
          : "Drop your finish book — PDF, PowerPoint, or spreadsheet — and we'll pull the products out for you. Or tag by hand below."}
      </p>
    </div>
  );
}

/**
 * The tray of finish-schedule products parsed but not yet placed on a photo.
 * "Place" arms placement for that product; the designer then clicks the photo
 * where it appears. "Dismiss" drops a row we don't want.
 */
function UnplacedTray({
  tags,
  placingId,
  onPlace,
  onDismiss,
}: {
  tags: SpecTag[];
  placingId: string | null;
  onPlace: (tag: SpecTag) => void;
  onDismiss: (tagId: string) => void;
}) {
  const fmtPrice = (cents: number | null) =>
    cents == null ? null : `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <section className="rounded-2xl border border-folio-border-subtle bg-surface-ground/60 p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="folio-ui font-semibold text-folio-text-primary">
          From your finish schedule · {tags.length} to place
        </h3>
        <p className="folio-meta text-folio-text-secondary mt-0.5">
          Place each product on the photo where it appears. Anything you don&apos;t need, dismiss.
        </p>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {tags.map((tag) => {
          const isPlacing = placingId === tag.id;
          const meta = [tag.extractedVendor, tag.category, tag.extractedDimensions, fmtPrice(tag.extractedPrice)]
            .filter(Boolean)
            .join(' · ');
          return (
            <li
              key={tag.id}
              className={`flex items-center gap-3 rounded-xl border bg-surface-canvas px-3 py-2 transition-colors ${
                isPlacing ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30' : 'border-folio-border-subtle'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="folio-ui font-medium text-folio-text-primary truncate">{tag.description}</p>
                <p className="folio-meta text-folio-text-secondary truncate">
                  {tag.roomType ? `${tag.roomType}${meta ? ' · ' : ''}` : ''}
                  {meta || (!tag.roomType ? 'From your finish schedule' : '')}
                </p>
              </div>
              <button
                onClick={() => onPlace(tag)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 folio-meta font-medium transition-colors ${
                  isPlacing
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-folio-border-subtle text-folio-text-primary hover:border-[var(--accent)]'
                }`}
              >
                <FaMapMarkerAlt className="w-3 h-3" />
                {isPlacing ? 'Placing…' : 'Place'}
              </button>
              <button
                onClick={() => onDismiss(tag.id)}
                title="Dismiss"
                className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-folio-text-tertiary hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <FaTimes className="w-3 h-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RoomLabel({ name, count, tagged }: { name: string; count: number; tagged?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-folio-border-subtle pb-2">
      <h3 className="font-headline italic text-2xl text-folio-text-primary">{name}</h3>
      <span className="folio-meta text-folio-text-tertiary tabular-nums whitespace-nowrap">
        {count} {count === 1 ? 'photo' : 'photos'}
        {tagged !== undefined ? ` · ${tagged} tagged` : ''}
      </span>
    </div>
  );
}

/**
 * A single photo with its tag list beside it. Collapsed by default; clicking
 * the photo expands it in place for pin-drop + product tagging.
 */
function PhotoTagger({
  projectId,
  photo,
  isOwner,
  active,
  onActivate,
  onCollapse,
  onChanged,
  onEditProduct,
  onConfirm,
  placing,
  onPlace,
}: {
  projectId: string;
  photo: Photo;
  isOwner: boolean;
  active: boolean;
  onActivate: () => void;
  onCollapse: () => void;
  onChanged: () => void;
  onEditProduct: (productId: string, tagId: string | null) => void;
  onConfirm: (tagId: string) => void;
  /** A finish-schedule product being placed; clicking the photo anchors it. */
  placing: SpecTag | null;
  onPlace: (imageId: string, x: number, y: number) => void;
}) {
  const [pendingDot, setPendingDot] = useState<{ x: number; y: number } | null>(null);
  // A tag being dragged to a new spot; its live position overrides the stored one.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Persist a dragged tag's new position. The stored AI position (aiX/aiY) is
  // left untouched so the AI-vs-designer delta is captured for later training.
  const moveTag = async (tagId: string, x: number, y: number) => {
    try {
      await fetch('/api/tag-product-to-image', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tagId, x, y }),
      });
      onChanged();
    } catch (err) {
      console.error('[TaggingSection] move tag error:', err);
    }
  };

  const clientToPct = (clientX: number, clientY: number) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  // Starting/stopping/switching a placement clears any stale pin so it can't
  // leak into the manual product picker.
  useEffect(() => {
    setPendingDot(null);
  }, [placing]);

  const placePin = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingDot({ x, y });
  };

  const handleDelete = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tag-product-to-image?id=${tagId}`, { method: 'DELETE' });
      if (res.ok) onChanged();
    } catch (err) {
      console.error('[TaggingSection] delete error:', err);
    }
  };

  const leave = () => {
    setPendingDot(null);
    onCollapse();
  };

  if (!active) {
    // Collapsed row: photo left, tags beside it (never over the photo).
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,340px)_1fr] gap-4 items-start">
        <button
          onClick={isOwner ? onActivate : undefined}
          className={`group relative aspect-[4/3] w-full rounded-[20px] overflow-hidden border-2 transition-all ${
            placing ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' : 'border-folio-border-subtle hover:border-[var(--accent)]'
          }`}
          title={isOwner ? (placing ? 'Click to place here' : 'Click to tag products') : undefined}
        >
          <Image
            src={photo.url}
            alt={photo.name || 'Project photo'}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 340px"
          />
          {/* Numbered pins for an at-a-glance view of where products are tagged. */}
          {photo.tags.map((t, i) => (
            <span
              key={t.id}
              className="pointer-events-none absolute z-10 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] border border-white text-[9px] font-semibold text-white shadow"
              style={{ left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {i + 1}
            </span>
          ))}
          {photo.tags.length > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <FaTag className="w-3 h-3" />
              {photo.tags.length}
            </div>
          )}
          {isOwner && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 bg-white/90 px-3 py-1.5 rounded-full text-sm font-medium text-folio-text-primary transition-opacity">
                {placing ? 'Place here' : 'Tag products'}
              </span>
            </div>
          )}
        </button>

        <TagList tags={photo.tags} isOwner={isOwner} onEdit={onEditProduct} onDelete={handleDelete} onConfirm={onConfirm} />
      </div>
    );
  }

  // Active (expanded) working state — enlarges in place, pushing the room down.
  return (
    <div className="rounded-2xl border-2 border-[var(--accent)] bg-surface-canvas p-4 sm:p-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Photo — the transient pin is the only mark placed on it */}
        <div>
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={photo.url}
              alt={photo.name || 'Project photo'}
              onClick={placePin}
              className="w-full rounded-xl cursor-crosshair"
            />
            {/* Placed product tags, shown as numbered pins (pin #n === list row
                #n). Drag a pin to reposition it — the new spot is saved and the
                AI's original guess is kept for training. */}
            {photo.tags.map((t, i) => {
              const pos = drag?.id === t.id ? drag : { x: t.x, y: t.y };
              return (
                <div
                  key={t.id}
                  className="absolute z-10 cursor-grab touch-none active:cursor-grabbing"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                  title={t.product?.name ? `${t.product.name} — drag to move` : 'Drag to move'}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({ id: t.id, x: t.x, y: t.y });
                  }}
                  onPointerMove={(e) => {
                    if (drag?.id !== t.id) return;
                    const p = clientToPct(e.clientX, e.clientY);
                    if (p) setDrag({ id: t.id, ...p });
                  }}
                  onPointerUp={(e) => {
                    if (drag?.id !== t.id) return;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    const finalPos = drag;
                    setDrag(null);
                    moveTag(t.id, finalPos.x, finalPos.y);
                  }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] border-2 border-white shadow-md">
                    <span className="text-[10px] font-semibold leading-none text-white">{i + 1}</span>
                  </div>
                </div>
              );
            })}
            {/* The transient placement pin while adding a new product. */}
            {pendingDot && (
              <div
                className="absolute z-20"
                style={{
                  left: `${pendingDot.x}%`,
                  top: `${pendingDot.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] border-2 border-white shadow-lg animate-pulse">
                  <FaTag className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="folio-meta text-folio-text-secondary">
              {placing
                ? pendingDot
                  ? 'Spot marked — confirm it beside.'
                  : `Click where ${placing.description} goes.`
                : pendingDot
                  ? 'Pin placed — pick the product beside it.'
                  : photo.tags.length > 0
                    ? 'Click to add a product, or drag a pin to move it.'
                    : 'Click the photo where a product is.'}
            </p>
            <button
              onClick={leave}
              className="folio-meta font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors whitespace-nowrap"
            >
              Done
            </button>
          </div>
        </div>

        {/* Right column — placement confirm, the picker, or the tag list */}
        <div>
          {placing ? (
            pendingDot ? (
              <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/5 p-4 space-y-3">
                <div>
                  <p className="folio-ui font-medium text-folio-text-primary">{placing.description}</p>
                  <p className="folio-meta text-folio-text-secondary">
                    {[placing.extractedVendor, placing.category].filter(Boolean).join(' · ') || 'From your finish schedule'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingDot(null)}
                    className="flex-1 px-4 py-2 rounded-lg border border-folio-border-subtle folio-meta font-medium text-folio-text-secondary hover:bg-surface-ground transition-colors"
                  >
                    Move pin
                  </button>
                  <button
                    onClick={() => onPlace(photo.id, pendingDot.x, pendingDot.y)}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent)] text-white folio-meta font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <FaMapMarkerAlt className="w-3 h-3" />
                    Place here
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--accent)]/50 bg-[var(--accent)]/5 p-4">
                <p className="folio-ui font-medium text-folio-text-primary">{placing.description}</p>
                <p className="folio-meta text-folio-text-secondary mt-0.5">
                  Click the photo where this product appears to place it.
                </p>
              </div>
            )
          ) : pendingDot ? (
            <ProductTagPicker
              projectId={projectId}
              imageId={photo.id}
              pendingDot={pendingDot}
              onCancel={() => setPendingDot(null)}
              onTagged={async ({ productId, deferred, openEdit }) => {
                setPendingDot(null);
                // Flagged/hard-domain products land pending; kick the background
                // fill best-effort. (Confirm-after UI is the next, gated step.)
                if (deferred) {
                  fetch(`/api/products/${productId}/scrape-bql`, { method: 'POST' }).catch(() => {});
                }
                onChanged();
                if (openEdit) onEditProduct(productId, null);
              }}
            />
          ) : (
            <div className="space-y-3">
              <TagList tags={photo.tags} isOwner={isOwner} onEdit={onEditProduct} onDelete={handleDelete} onConfirm={onConfirm} />
              <p className="folio-meta text-folio-text-tertiary">
                Click the photo to add another product.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The per-photo tag list. Rows sit beside the photo. Manual tags render in a
 * confirmed state; the `pending` branch is left in place (structurally) for the
 * imported confirm-after state to fill later without reworking the list.
 */
function TagList({
  tags,
  isOwner,
  onEdit,
  onDelete,
  onConfirm,
}: {
  tags: TagRow[];
  isOwner: boolean;
  onEdit: (productId: string, tagId: string | null) => void;
  onDelete: (tagId: string) => void;
  onConfirm: (tagId: string) => void;
}) {
  if (tags.length === 0) {
    return (
      <p className="folio-meta text-folio-text-tertiary py-2">
        No products tagged yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {tags.map((tag, i) => {
        const product = tag.product;
        // Imported/deferred tags await confirmation; manual tags are confirmed.
        const pending = product?.scrapeStatus != null && !tag.reviewedAt;
        return (
          <li
            key={tag.id}
            className="flex items-center gap-3 rounded-xl border border-folio-border-subtle bg-surface-canvas px-3 py-2"
          >
            {/* Matches the numbered pin on the photo. */}
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="folio-ui font-medium text-folio-text-primary truncate">
                {product?.name ?? 'Product'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {product?.category && (
                  <span className="folio-meta text-folio-text-secondary truncate">
                    {product.category}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 folio-meta text-folio-text-tertiary">
                  <FaMapMarkerAlt className="w-2.5 h-2.5 text-[var(--accent)]" />
                  Placed
                </span>
                {pending ? (
                  <span className="inline-flex items-center gap-1 folio-meta text-amber-600">
                    <FaRegClock className="w-2.5 h-2.5" />
                    Needs confirm
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 folio-meta text-[var(--accent)]">
                    <FaCheckCircle className="w-2.5 h-2.5" />
                    Confirmed
                  </span>
                )}
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {pending && (
                  <button
                    onClick={() => onConfirm(tag.id)}
                    title="Confirm this tag"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                  >
                    <FaCheck className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => product && onEdit(product.id, tag.id)}
                  disabled={!product}
                  title="Edit product details"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-folio-text-secondary hover:text-folio-text-primary hover:bg-surface-ground transition-colors disabled:opacity-40"
                >
                  <FaPen className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onDelete(tag.id)}
                  title="Remove tag"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <FaTrash className="w-3 h-3" />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
