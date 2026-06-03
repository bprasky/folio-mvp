'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import Image from 'next/image';
import { FaImage, FaTag, FaCheckCircle, FaTrash } from 'react-icons/fa';
import { ChevronDown, ChevronRight, Plus, X, Undo2, DoorOpen, Ban } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  MeasuringStrategy,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  assignImageToRoom,
  excludeImage,
  includeImage,
  unassignImage,
  createRoom,
  setImageNoProducts,
  renameRoom,
} from '@/app/actions/projectImages';
import { isDocumentImage } from '@/lib/publish/computePublishReadiness';

interface WorkspaceImage {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
  roomId?: string | null;
  inclusion?: 'INCLUDED' | 'EXCLUDED';
  noProducts?: boolean;
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
 * Uncategorized is pinned to the top; Excluded collapses to the bottom.
 *
 * Re-sorting is drag-and-drop: grab any photo and a room dock rises from the
 * bottom with every room as a drop target (plus New room and Leave out), so
 * you never have to scroll to the destination. Photos stay bare — no
 * glass/mesh/overlay over the image.
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
  const [activeImage, setActiveImage] = useState<WorkspaceImage | null>(null);
  const [namingForImageId, setNamingForImageId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Only photos are sorted into rooms; source documents are not portfolio shots.
  const photos = useMemo(() => images.filter(img => !isDocumentImage(img.name)), [images]);

  const excluded = photos.filter(img => img.inclusion === 'EXCLUDED');
  const active = photos.filter(img => img.inclusion !== 'EXCLUDED');
  const uncategorized = active.filter(img => !img.roomId);

  const roomBuckets = rooms
    .map(room => ({ room, photos: active.filter(img => img.roomId === room.id) }))
    .filter(bucket => bucket.photos.length > 0);

  // Counts for every room (including empty ones) so the dock can offer them all.
  const roomCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rooms) m.set(r.id, active.filter(img => img.roomId === r.id).length);
    return m;
  }, [rooms, active]);

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

  function handleDragStart(event: DragStartEvent) {
    const img = active.find(i => i.id === event.active.id) ?? null;
    setActiveImage(img);
  }

  function handleDragEnd(event: DragEndEvent) {
    const imageId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveImage(null);
    if (!overId) return;

    if (overId === 'new-room') {
      setNamingForImageId(imageId);
    } else if (overId === 'exclude') {
      run(() => excludeImage({ imageId }));
    } else if (overId === 'uncategorized') {
      run(() => unassignImage({ imageId }));
    } else if (overId.startsWith('room:')) {
      const roomId = overId.slice('room:'.length);
      run(() => assignImageToRoom({ imageId, roomId }));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveImage(null)}
      autoScroll={false}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
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
                  Drag a photo onto a room, or use the menu below each one.
                  <span className="ml-1 text-folio-text-tertiary">
                    ({uncategorized.length} left)
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uncategorized.map(img => (
                <div key={img.id} className="space-y-2">
                  <DraggablePhoto id={img.id} disabled={!isOwner}>
                    <PhotoCard
                      img={img}
                      isOwner={isOwner}
                      cover={isCover(img.id)}
                      badge="Not in a room yet"
                      onSetCover={onSetCover}
                      onDelete={onDelete}
                    />
                  </DraggablePhoto>
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

        {/* Room names appear in the published article — nudge to make them specific. */}
        {roomBuckets.length > 0 && (
          <p className="folio-meta text-folio-text-tertiary">
            Room names appear in your published article. We sorted your photos and numbered any
            repeats — rename rooms to be specific (e.g. “Primary Bath”, “Powder Room”). Drag any
            photo to move it.
          </p>
        )}

        {/* One group per room with photos */}
        {roomBuckets.map(({ room, photos: roomPhotos }) => {
          const tagged = roomPhotos.filter(img => img.tags.length > 0).length;
          return (
            <section key={room.id} className="space-y-4">
              <RoomHeader
                roomId={room.id}
                name={room.name}
                photoCount={roomPhotos.length}
                taggedCount={tagged}
                isOwner={isOwner}
                onRenamed={onChanged}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roomPhotos.map(img => (
                  <DraggablePhoto key={img.id} id={img.id} disabled={!isOwner}>
                    <PhotoCard
                      img={img}
                      isOwner={isOwner}
                      cover={isCover(img.id)}
                      badge={img.noProducts && img.tags.length === 0 ? 'No products' : undefined}
                      onClearNoProducts={
                        img.noProducts
                          ? () => run(() => setImageNoProducts({ imageId: img.id, value: false }))
                          : undefined
                      }
                      onSetCover={onSetCover}
                      onDelete={onDelete}
                    />
                  </DraggablePhoto>
                ))}
              </div>
            </section>
          );
        })}

        {/* Add room inline */}
        {isOwner && (
          <AddRoomAffordance projectId={projectId} disabled={isPending} onCreated={onChanged} />
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

      {/* Sorting overlay — covers the page while dragging (no page scroll),
          every room is a big drop target laid out at once. */}
      {activeImage && (
        <SortOverlay
          image={activeImage}
          rooms={rooms}
          roomCounts={roomCounts}
          currentRoomId={activeImage.roomId ?? null}
        />
      )}

      {/* Floating preview of the dragged photo */}
      <DragOverlay dropAnimation={null} zIndex={60}>
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeImage.url}
            alt=""
            className="w-40 h-32 object-cover rounded-xl shadow-2xl ring-2 ring-[var(--accent)] rotate-2"
          />
        ) : null}
      </DragOverlay>

      {/* Drop-on-"New room" → create + assign */}
      {namingForImageId && (
        <NewRoomNamer
          projectId={projectId}
          imageId={namingForImageId}
          onClose={() => setNamingForImageId(null)}
          onDone={onChanged}
        />
      )}
    </DndContext>
  );
}

function DraggablePhoto({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={`${disabled ? '' : 'cursor-grab active:cursor-grabbing touch-none'} ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {children}
    </div>
  );
}

function SortOverlay({
  image,
  rooms,
  roomCounts,
  currentRoomId,
}: {
  image: WorkspaceImage;
  rooms: RoomLite[];
  roomCounts: Map<string, number>;
  currentRoomId: string | null;
}) {
  // Lock page scroll while sorting so the cursor stays glued to the photo.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 glass-backdrop" />

      <div className="relative warm-mesh rounded-3xl bg-surface-ground border border-folio-border-subtle shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="relative z-[1] flex items-center gap-4 px-7 pt-6 pb-4 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt=""
            className="w-20 h-16 object-cover rounded-lg ring-2 ring-[var(--accent)] shrink-0"
          />
          <div>
            <h3 className="font-headline italic text-2xl text-folio-text-primary">Drop into a room</h3>
            <p className="folio-meta text-folio-text-secondary mt-0.5">
              Drag the photo onto a room. Release to move it.
            </p>
          </div>
        </div>

        <div className="relative z-[1] px-7 pb-7 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rooms.map(r => (
              <OverlayTile
                key={r.id}
                id={`room:${r.id}`}
                label={r.name}
                sub={`${roomCounts.get(r.id) ?? 0} photos`}
                muted={r.id === currentRoomId}
              />
            ))}
            <OverlayTile id="new-room" label="New room" sub="name it next" icon={<Plus className="w-5 h-5" />} accent />
            {currentRoomId && (
              <OverlayTile id="uncategorized" label="Uncategorized" icon={<DoorOpen className="w-5 h-5" />} />
            )}
            <OverlayTile id="exclude" label="Leave out" icon={<Ban className="w-5 h-5" />} />
          </div>
        </div>
      </div>
    </div>
  );
}

function OverlayTile({
  id,
  label,
  sub,
  icon,
  accent,
  muted,
}: {
  id: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  muted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center justify-center text-center gap-1 rounded-2xl border-2 px-3 py-6 min-h-[96px] transition-all ${
        isOver
          ? 'border-[var(--accent)] bg-[var(--accent)]/15 scale-[1.03]'
          : accent
            ? 'border-dashed border-[var(--accent)]/50 bg-[var(--accent)]/5'
            : `border-dashed ${muted ? 'border-folio-border-subtle/60 opacity-60' : 'border-folio-border-subtle bg-surface-canvas'}`
      }`}
    >
      {icon && <span className="text-folio-text-secondary">{icon}</span>}
      <span className="folio-ui font-medium text-folio-text-primary leading-tight">{label}</span>
      {sub !== undefined && (
        <span className="folio-meta text-folio-text-tertiary tabular-nums">{sub}</span>
      )}
    </div>
  );
}

function NewRoomNamer({
  projectId,
  imageId,
  onClose,
  onDone,
}: {
  projectId: string;
  imageId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await createRoom({ projectId, name: name.trim() });
      if (res?.room?.id) {
        await assignImageToRoom({ imageId, roomId: res.room.id });
      }
      onDone();
      onClose();
    } catch (err) {
      console.error('[NewRoomNamer] create+assign failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to add room');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-backdrop" onClick={onClose} />
      <div className="relative warm-mesh rounded-2xl bg-surface-ground border border-folio-border-subtle shadow-2xl max-w-sm w-full p-6">
        <div className="relative z-[1]">
          <h3 className="font-headline italic text-2xl text-folio-text-primary mb-1">Name the room</h3>
          <p className="folio-meta text-folio-text-secondary mb-4">
            This photo moves in, and the name appears in your article.
          </p>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') create();
                if (e.key === 'Escape') onClose();
              }}
              placeholder="e.g. Primary Bath"
              className="flex-1 min-w-0 px-3 py-2 folio-ui rounded-xl border border-folio-border-subtle bg-surface-canvas focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={create}
              disabled={busy || !name.trim()}
              className="px-4 py-2 folio-ui font-semibold text-white bg-[var(--accent)] rounded-xl hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomHeader({
  roomId,
  name,
  photoCount,
  taggedCount,
  isOwner,
  onRenamed,
}: {
  roomId: string;
  name: string;
  photoCount: number;
  taggedCount: number;
  isOwner: boolean;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = value.trim();
    if (!next || next === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setBusy(true);
    try {
      await renameRoom({ roomId, name: next });
      setEditing(false);
      onRenamed();
    } catch (err) {
      console.error('[RoomHeader] rename failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to rename room');
      setValue(name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-folio-border-subtle pb-2">
      {editing ? (
        <input
          autoFocus
          value={value}
          disabled={busy}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') { setEditing(false); setValue(name); }
          }}
          className="font-headline italic text-2xl text-folio-text-primary bg-transparent border-b border-[var(--accent)] focus:outline-none min-w-0 flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => isOwner && setEditing(true)}
          title={isOwner ? 'Rename — appears in your article' : undefined}
          className={`font-headline italic text-2xl text-folio-text-primary text-left ${
            isOwner ? 'hover:text-[var(--accent)] transition-colors cursor-text' : 'cursor-default'
          }`}
        >
          {name}
        </button>
      )}
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
  onClearNoProducts,
  onSetCover,
  onDelete,
}: {
  img: WorkspaceImage;
  isOwner: boolean;
  cover: boolean;
  badge?: string;
  /** When set, the card offers a reopen action that clears the no-products flag. */
  onClearNoProducts?: () => void;
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
        className="object-cover relative z-[1] pointer-events-none"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        draggable={false}
      />

      {tagCount > 0 && (
        <div className="absolute bottom-2 right-2 z-[2] bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
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
          {onClearNoProducts && (
            <button
              onClick={onClearNoProducts}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-surface-canvas text-folio-text-primary hover:bg-surface-ground transition-colors"
            >
              Reopen to tag
            </button>
          )}
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
