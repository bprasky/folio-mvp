'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface RoomDiagnostic {
  roomId: string;
  roomName: string;
  selections: {
    total: number;
    withProductMatch: number;
    alreadyLinkedToTag: number;
  };
  images: {
    total: number;
    tagged: number;
    untagged: number;
  };
  autoTaggable: boolean;
}

interface DiagnosticData {
  rooms: RoomDiagnostic[];
  summary: {
    totalSelections: number;
    totalImages: number;
    taggedImages: number;
    classifiedImages: number;
    autoTaggableRooms: number;
    imagesWithoutRoom: number;
    needsAttention: boolean;
    hasNoTags: boolean;
    hasNoClassifications: boolean;
    hasAutoTaggable: boolean;
  };
}

interface TagDiagnosticModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onAutoTagComplete?: () => void;
}

export function TagDiagnosticModal({
  open,
  onOpenChange,
  projectId,
  onAutoTagComplete,
}: TagDiagnosticModalProps) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagResult, setAutoTagResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);

  const fetchDiagnostic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/tag-diagnostic`
      );
      if (!res.ok) throw new Error('Failed to fetch diagnostic');
      const data: DiagnosticData = await res.json();
      setDiagnostic(data);

      // Pre-select all autoTaggable rooms
      const autoTaggable = new Set(
        data.rooms.filter((r) => r.autoTaggable).map((r) => r.roomId)
      );
      setSelectedRoomIds(autoTaggable);
    } catch (err: any) {
      setError(err.message || 'Failed to load diagnostic');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchDiagnostic();
      setAutoTagResult(null);
    }
  }, [open, fetchDiagnostic]);

  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  const handleAutoTag = async () => {
    if (selectedRoomIds.size === 0) return;
    setAutoTagging(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/auto-tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomIds: Array.from(selectedRoomIds) }),
        }
      );
      if (!res.ok) throw new Error('Auto-tag failed');
      const data = await res.json();
      setAutoTagResult(data.summary);
      onAutoTagComplete?.();
    } catch (err: any) {
      setError(err.message || 'Auto-tag failed');
    } finally {
      setAutoTagging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tag Products for Attribution</DialogTitle>
          <DialogDescription className="mt-1">
            Tagged products get vendor attribution and help viewers shop your
            project.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading && (
            <p className="text-sm text-[var(--text-secondary)] py-4">
              Checking tag readiness...
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 mb-4">
              {error}
            </div>
          )}

          {autoTagResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 mb-4">
              Created {autoTagResult.created} tag
              {autoTagResult.created !== 1 ? 's' : ''}.
              {autoTagResult.skipped > 0 && (
                <> {autoTagResult.skipped} skipped (no product match or already tagged).</>
              )}
            </div>
          )}

          {diagnostic && !loading && (
            <>
              {/* Readiness warnings */}
              <div className="space-y-2 mb-4">
                {diagnostic.summary.hasNoTags && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <p className="font-medium">No products tagged on photos</p>
                    <p className="text-xs mt-0.5">
                      Tagging products on your photos enables vendor attribution and generates better interview questions.
                      {diagnostic.summary.hasAutoTaggable
                        ? ' Select rooms below to auto-tag from your design board.'
                        : ' Tag products manually in the image viewer, or add products to your design board first.'}
                    </p>
                  </div>
                )}
                {diagnostic.summary.hasNoClassifications && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <p className="font-medium">Photos not yet analyzed by AI</p>
                    <p className="text-xs mt-0.5">
                      AI classification detects colors, materials, and styles in your photos to generate personalized interview questions. This runs automatically — try refreshing in a moment.
                    </p>
                  </div>
                )}
                {!diagnostic.summary.hasNoTags && !diagnostic.summary.hasNoClassifications && diagnostic.summary.hasAutoTaggable && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    <p className="font-medium">Some products can be auto-tagged</p>
                    <p className="text-xs mt-0.5">
                      We found design board selections that match products in untagged photos. Auto-tag them for better attribution.
                    </p>
                  </div>
                )}
              </div>

              {/* Summary stats */}
              <div className="flex gap-4 text-xs text-[var(--text-secondary)] mb-3 px-1">
                <span>{diagnostic.summary.totalImages} photo{diagnostic.summary.totalImages !== 1 ? 's' : ''}</span>
                <span>{diagnostic.summary.taggedImages} tagged</span>
                <span>{diagnostic.summary.classifiedImages} classified</span>
                <span>{diagnostic.summary.totalSelections} on board</span>
              </div>

              {diagnostic.rooms.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] py-2">
                  No rooms found. Add rooms and selections to your design board first.
                </p>
              ) : diagnostic.summary.hasAutoTaggable ? (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {diagnostic.rooms.filter((r) => r.autoTaggable || r.images.untagged > 0).map((room) => {
                    const disabled = !room.autoTaggable;
                    const checked = selectedRoomIds.has(room.roomId);
                    return (
                      <label
                        key={room.roomId}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                          disabled
                            ? 'border-[var(--ridge-outer)] opacity-50 cursor-default'
                            : checked
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-[var(--ridge-outer)] hover:bg-[var(--bg-muted)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleRoom(room.roomId)}
                          className="mt-0.5 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)]">
                            {room.roomName}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {room.selections.total} product
                            {room.selections.total !== 1 ? 's' : ''} on board
                            {room.selections.withProductMatch > 0 && (
                              <>, {room.selections.withProductMatch} matchable</>
                            )}
                            {' \u2022 '}
                            {room.images.total} photo
                            {room.images.total !== 1 ? 's' : ''}
                            {room.images.untagged > 0 && (
                              <>, {room.images.untagged} untagged</>
                            )}
                          </p>
                          {room.selections.alreadyLinkedToTag > 0 && (
                            <p className="text-xs text-green-600">
                              {room.selections.alreadyLinkedToTag} already linked
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                {diagnostic.summary.hasAutoTaggable && (
                  <button
                    onClick={handleAutoTag}
                    disabled={selectedRoomIds.size === 0 || autoTagging}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {autoTagging
                      ? 'Auto-tagging...'
                      : `Auto-tag ${selectedRoomIds.size} room${selectedRoomIds.size !== 1 ? 's' : ''}`}
                  </button>
                )}
                <button
                  onClick={() => onOpenChange(false)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    diagnostic.summary.hasAutoTaggable
                      ? 'text-[var(--text-secondary)] border border-[var(--ridge-outer)] hover:bg-[var(--bg-muted)]'
                      : 'flex-1 text-white bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {diagnostic.summary.hasAutoTaggable ? 'Skip for now' : 'Continue to Interview'}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
