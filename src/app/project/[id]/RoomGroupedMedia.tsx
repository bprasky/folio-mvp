'use client';

import { useState, useMemo, useTransition } from 'react';
import Image from 'next/image';
import { FaImage, FaTag, FaCheckCircle, FaTrash } from 'react-icons/fa';
import { ChevronDown, ChevronRight, Plus, X, Undo2 } from 'lucide-react';
import {
  assignImageToRoom,
  excludeImage,
  includeImage,
  createRoom,
} from '@/app/actions/projectImages';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';

interface WorkspaceImage {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
  roomId?: string | null;
  inclusion?: 'INCLUDED' | 'EXCLUDED';
  aiSpaces?: string[];
  tags: Array<{ id: string }>;
}

interface RoomLite {
  id: string;
  name: string;
  type?: string | null;
}

interface RoomGroupedMediaProps {
  projectId: string;
  isOwner: boolean;
  images: WorkspaceImage[];
  rooms: RoomLite[];
  selectedHeroImageId: string | null;
  heroAssetId?: string | null;
  onSetCover: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onChanged: () => void;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '');

/** Suggest a room for an uncategorized photo from AI signals — never auto-applied. */
function suggestRoomId(img: WorkspaceImage, rooms: RoomLite[]): string {
  const hints = [...(img.aiSpaces ?? []), img.room ?? ''].map(norm).filter(Boolean);
  if (hints.length === 0) return '';
  const match = rooms.find(
    r => hints.includes(norm(r.name)) || (r.type ? hints.includes(norm(r.type)) : false),
  );
  return match?.id ?? '';
}

/**
 * Room-grouped media workspace (spec 20 §3c). Photos render grouped by room.
 * Uncategorized is pinned to the top; Excluded collapses to the bottom. Every
 * photo lives in exactly one of: a room, Uncategorized, or Excluded.
 *
 * Photos are sacred — cards are bare, no glass/mesh/overlay over the image.
 */
export default function RoomGroupedMedia({
  projectId,
  isOwner,
  images,
  rooms,
  selectedHeroImageId,
  heroAssetId,
  onSetCover,
  onDelete,
  onChanged,
}: RoomGroupedMediaProps) {
  const [isPending, startTransition] = useTransition();
  const [excludedOpen, setExcludedOpen] = useState(false);

  // Only photos are sorted into rooms; source documents are not portfolio shots.
  const photos = useMemo(() => images.filter(img => !isDocumentImage(img.name)), [images]);

  const excluded = photos.filter(img => img.inclusion === 'EXCLUDED');
  const active = photos.filter(img => img.inclusion !== 'EXCLUDED');
  const uncategorized = active.filter(img => !img.roomId);

  const roomBuckets = rooms
    .map(room => ({ room, photos: active.filter(img => img.roomId === room.id) }))
    .filter(bucket => bucket.photos.length > 0);

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        onChanged();
      } catch (err) {
        console.error('[RoomGroupedMedia] action failed:', err);
        alert(err instanceof Error ? err.message : 'Something went wrong');
      }
    });

  const isCover = (id: string) => selectedHeroImageId === id || heroAssetId === id;

  return (
    <div className="space-y-8">
      {/* Uncategorized — pinned top, only when non-empty */}
      {uncategorized.length > 0 && (
        <section id="uncategorized-group" className="space-y-4">
          <div className="glass-surface warm-mesh rounded-2xl px-5 py-4">
            <div className="relative z-[1]">
              <h3 className="font-headline italic text-2xl text-folio-text-primary">
                Sort your photos
              </h3>
              <p className="folio-meta text-folio-text-secondary mt-1">
                Every photo joins a room or steps out of this project. Nothing stays unsorted.
                <span className="ml-1 text-folio-text-tertiary">
                  ({uncategorized.length} left)
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {uncategorized.map(img => (
              <div key={img.id} className="space-y-2">
                <PhotoCard
                  img={img}
                  isOwner={isOwner}
                  cover={isCover(img.id)}
                  badge="Not in a room yet"
                  onSetCover={onSetCover}
                  onDelete={onDelete}
                />
                {isOwner && (
                  <UncategorizedResolver
                    img={img}
                    rooms={rooms}
                    projectId={projectId}
                    disabled={isPending}
                    onAssign={(roomId) => run(() => assignImageToRoom({ imageId: img.id, roomId }))}
                    onExclude={() => run(() => excludeImage({ imageId: img.id }))}
                    onChanged={onChanged}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* One group per room with photos */}
      {roomBuckets.map(({ room, photos: roomPhotos }) => {
        const tagged = roomPhotos.filter(img => img.tags.length > 0).length;
        return (
          <section key={room.id} className="space-y-4">
            <RoomHeader name={room.name} photoCount={roomPhotos.length} taggedCount={tagged} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roomPhotos.map(img => (
                <PhotoCard
                  key={img.id}
                  img={img}
                  isOwner={isOwner}
                  cover={isCover(img.id)}
                  onSetCover={onSetCover}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Add room inline */}
      {isOwner && (
        <AddRoomAffordance
          projectId={projectId}
          disabled={isPending}
          onCreated={onChanged}
        />
      )}

      {/* Excluded — collapsed, restorable */}
      {excluded.length > 0 && (
        <section className="border-t border-folio-border-subtle pt-5">
          <button
            onClick={() => setExcludedOpen(o => !o)}
            className="flex items-center gap-2 folio-ui font-medium text-folio-text-secondary hover:text-folio-text-primary transition-colors"
          >
            {excludedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Left out of this project ({excluded.length})
          </button>
          {excludedOpen && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
              {excluded.map(img => (
                <div key={img.id} className="space-y-2">
                  <div className="relative aspect-[4/3] bg-surface-canvas rounded-xl overflow-hidden border border-folio-border-subtle opacity-70">
                    <Image
                      src={img.url}
                      alt={img.name || 'Excluded photo'}
                      fill
                      className="object-cover grayscale"
                      sizes="(max-width: 768px) 50vw, 16vw"
                    />
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => run(() => includeImage({ imageId: img.id }))}
                      disabled={isPending}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 folio-meta font-medium text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors disabled:opacity-50"
                    >
                      <Undo2 className="w-3 h-3" />
                      Bring back
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function RoomHeader({
  name,
  photoCount,
  taggedCount,
}: {
  name: string;
  photoCount: number;
  taggedCount: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-folio-border-subtle pb-2">
      <h3 className="font-headline italic text-2xl text-folio-text-primary">{name}</h3>
      <span className="folio-meta text-folio-text-tertiary tabular-nums whitespace-nowrap">
        {photoCount} {photoCount === 1 ? 'photo' : 'photos'} · {taggedCount} tagged
      </span>
    </div>
  );
}

function PhotoCard({
  img,
  isOwner,
  cover,
  badge,
  onSetCover,
  onDelete,
}: {
  img: WorkspaceImage;
  isOwner: boolean;
  cover: boolean;
  badge?: string;
  onSetCover: (imageId: string) => void;
  onDelete: (imageId: string) => void;
}) {
  const tagCount = img.tags.length;
  return (
    <div
      className={`relative group aspect-[4/3] bg-surface-canvas rounded-[20px] overflow-hidden border-2 ${
        cover ? 'border-[var(--accent)]' : 'border-folio-border-subtle hover:border-[var(--accent)]'
      } transition-all`}
    >
      <div className="absolute inset-0 bg-stone-100 border border-stone-200 rounded-[20px] flex flex-col items-center justify-center">
        <FaImage className="w-8 h-8 text-stone-300 mb-2" />
        <span className="folio-meta text-stone-400">Image unavailable</span>
      </div>
      <Image
        src={img.url}
        alt={img.name || 'Project photo'}
        fill
        className="object-cover relative z-[1]"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />

      {tagCount > 0 && (
        <div className="absolute top-2 right-2 z-[2] bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
          <FaTag className="w-3 h-3" />
          {tagCount}
        </div>
      )}

      {cover && (
        <div className="absolute top-2 left-2 z-[2] bg-[var(--accent)] text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          <FaCheckCircle className="w-3 h-3" />
          Cover
        </div>
      )}

      {badge && !cover && (
        <div className="absolute bottom-2 left-2 z-[2] bg-black/55 text-white px-2 py-1 rounded-full text-[11px] font-medium">
          {badge}
        </div>
      )}

      {isOwner && (
        <div className="absolute inset-0 z-[2] bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => onSetCover(img.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              cover
                ? 'bg-[var(--accent)] text-white'
                : 'bg-surface-canvas text-folio-text-primary hover:bg-surface-ground'
            }`}
          >
            {cover ? 'Cover Selected' : 'Set as Cover'}
          </button>
          <button
            onClick={() => onDelete(img.id)}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-[rgb(74,44,59)] text-white hover:bg-[rgb(74,44,59)]/80 transition-colors"
          >
            <FaTrash className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function UncategorizedResolver({
  img,
  rooms,
  projectId,
  disabled,
  onAssign,
  onExclude,
  onChanged,
}: {
  img: WorkspaceImage;
  rooms: RoomLite[];
  projectId: string;
  disabled: boolean;
  onAssign: (roomId: string) => void;
  onExclude: () => void;
  onChanged: () => void;
}) {
  const suggestedId = useMemo(() => suggestRoomId(img, rooms), [img, rooms]);
  const [selected, setSelected] = useState<string>(suggestedId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const suggestedRoom = rooms.find(r => r.id === suggestedId);

  async function handleCreateAndAssign() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await createRoom({ projectId, name: newName.trim() });
      if (res?.room?.id) {
        await assignImageToRoom({ imageId: img.id, roomId: res.room.id });
      }
      setCreating(false);
      setNewName('');
      onChanged();
    } catch (err) {
      console.error('[UncategorizedResolver] create+assign failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to add room');
    } finally {
      setBusy(false);
    }
  }

  if (creating) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateAndAssign()}
          placeholder="New room name"
          className="flex-1 min-w-0 px-2.5 py-1.5 folio-meta rounded-lg border border-folio-border-subtle bg-surface-canvas focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleCreateAndAssign}
          disabled={busy || !newName.trim()}
          className="px-2.5 py-1.5 folio-meta font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={() => { setCreating(false); setNewName(''); }}
          className="p-1.5 text-folio-text-tertiary hover:text-folio-text-secondary"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={e => {
            if (e.target.value === '__new__') {
              setCreating(true);
            } else {
              setSelected(e.target.value);
            }
          }}
          className="flex-1 min-w-0 px-2.5 py-1.5 folio-meta rounded-lg border border-folio-border-subtle bg-surface-canvas focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Choose a room…</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
          <option value="__new__">+ New room…</option>
        </select>
        <button
          onClick={() => selected && onAssign(selected)}
          disabled={disabled || !selected}
          className="px-2.5 py-1.5 folio-meta font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          Assign
        </button>
        <button
          onClick={onExclude}
          disabled={disabled}
          className="px-2.5 py-1.5 folio-meta font-medium text-folio-text-secondary border border-folio-border-subtle rounded-lg hover:bg-surface-ground transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          Leave out
        </button>
      </div>
      {suggestedRoom && selected === suggestedRoom.id && (
        <p className="folio-meta text-folio-text-tertiary">
          Suggested: {suggestedRoom.name}
        </p>
      )}
    </div>
  );
}

function AddRoomAffordance({
  projectId,
  disabled,
  onCreated,
}: {
  projectId: string;
  disabled: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createRoom({ projectId, name: name.trim() });
      setName('');
      setOpen(false);
      onCreated();
    } catch (err) {
      console.error('[AddRoomAffordance] create failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to add room');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-4 py-2.5 folio-ui font-medium text-folio-text-secondary border border-dashed border-folio-border-subtle rounded-2xl hover:border-[var(--accent)] hover:text-folio-text-primary transition-colors disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        Add room
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 max-w-sm">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleCreate()}
        placeholder="Room name"
        className="flex-1 min-w-0 px-3 py-2 folio-ui rounded-xl border border-folio-border-subtle bg-surface-canvas focus:outline-none focus:border-[var(--accent)]"
      />
      <button
        onClick={handleCreate}
        disabled={busy || !name.trim()}
        className="px-4 py-2 folio-ui font-medium text-white bg-[var(--accent)] rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        Add room
      </button>
      <button
        onClick={() => { setOpen(false); setName(''); }}
        className="p-2 text-folio-text-tertiary hover:text-folio-text-secondary"
        aria-label="Cancel"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
