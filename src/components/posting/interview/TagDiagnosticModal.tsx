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
  /** Called when the user clicks "Start Interview" — only available when ready */
  onStartInterview?: () => void;
}

/** Checklist icon — filled accent circle with checkmark when done, subtle ring when pending */
function ChecklistIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full border-2 border-folio-border-subtle flex-shrink-0" />
  );
}

/** Spinner icon for in-progress states */
function SpinnerIcon() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin flex-shrink-0" />
  );
}

/** Subtle loading dots animation */
function LoadingDots() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] opacity-60 animate-pulse" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] opacity-60 animate-pulse" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] opacity-60 animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

export function TagDiagnosticModal({
  open,
  onOpenChange,
  projectId,
  onAutoTagComplete,
  onStartInterview,
}: TagDiagnosticModalProps) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagDone, setAutoTagDone] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyDone, setClassifyDone] = useState(false);

  const fetchDiagnostic = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/tag-diagnostic`
      );
      if (!res.ok) return null;
      const data: DiagnosticData = await res.json();
      setDiagnostic(data);

      // Pre-select all autoTaggable rooms
      const autoTaggable = new Set(
        data.rooms.filter((r) => r.autoTaggable).map((r) => r.roomId)
      );
      setSelectedRoomIds(autoTaggable);
      return data;
    } catch {
      return null;
    }
  }, [projectId]);

  // On open: fetch diagnostic, auto-classify if needed, then auto-tag if possible
  useEffect(() => {
    if (!open) return;
    setAutoTagDone(false);
    setClassifyDone(false);
    setClassifying(false);
    setLoading(true);

    (async () => {
      let data = await fetchDiagnostic();
      setLoading(false);

      // Gate: if photos exist but aren't classified, classify them now
      if (data && data.summary.totalImages > 0 && data.summary.classifiedImages === 0) {
        setClassifying(true);
        try {
          const res = await fetch(
            `/api/posting/project/${projectId}/classify-images`,
            { method: 'POST' }
          );
          if (res.ok) {
            setClassifyDone(true);
            // Re-fetch diagnostic with updated classification data
            data = await fetchDiagnostic();
          }
        } catch {
          // Silent — checklist will still show unchecked
        } finally {
          setClassifying(false);
        }
      }

      // Auto-tag: always attempt if there are rooms with selections AND
      // untagged images. The diagnostic's hasAutoTaggable flag can be
      // stale because the backfill above may have just created Products.
      // The auto-tag endpoint re-resolves selections itself, so it's
      // safe to call even when the diagnostic thinks it won't work.
      const hasUntaggedImages = (data?.summary.totalImages ?? 0) > (data?.summary.taggedImages ?? 0);
      const hasSelections = (data?.summary.totalSelections ?? 0) > 0;

      if (hasUntaggedImages && hasSelections) {
        // Send all room IDs — the auto-tag endpoint filters internally
        const allRoomIds = data?.rooms.map((r) => r.roomId) ?? [];

        if (allRoomIds.length > 0) {
          setAutoTagging(true);
          try {
            const res = await fetch(
              `/api/posting/project/${projectId}/auto-tag`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomIds: allRoomIds }),
              }
            );
            if (res.ok) {
              const result = await res.json();
              if (result.summary?.created > 0) {
                setAutoTagDone(true);
                onAutoTagComplete?.();
              }
              // Re-fetch diagnostic to show updated state
              await fetchDiagnostic();
            }
          } catch {
            // Silent — user can still trigger manually
          } finally {
            setAutoTagging(false);
          }
        }
      }
    })();
  }, [open, projectId, fetchDiagnostic]);

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
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/auto-tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomIds: Array.from(selectedRoomIds) }),
        }
      );
      if (!res.ok) return;
      setAutoTagDone(true);
      onAutoTagComplete?.();
      // Re-fetch diagnostic to update checklist
      await fetchDiagnostic();
    } catch {
      // Silently handle
    } finally {
      setAutoTagging(false);
    }
  };

  const handleClassify = async () => {
    setClassifying(true);
    try {
      const res = await fetch(
        `/api/posting/project/${projectId}/classify-images`,
        { method: 'POST' }
      );
      if (res.ok) {
        setClassifyDone(true);
        await fetchDiagnostic();
      }
    } catch {
      // Silent
    } finally {
      setClassifying(false);
    }
  };

  // Readiness checks
  const hasPhotos = (diagnostic?.summary.totalImages ?? 0) > 0;
  const hasAIAnalysis = (diagnostic?.summary.classifiedImages ?? 0) > 0;
  const hasTaggedProducts = (diagnostic?.summary.taggedImages ?? 0) > 0;
  const canAutoTag = diagnostic?.summary.hasAutoTaggable ?? false;

  // Ready when: photos exist AND at least one of (tags or AI analysis)
  const isReady = hasPhotos && (hasTaggedProducts || hasAIAnalysis);

  const handleStartInterview = () => {
    if (onStartInterview) {
      onStartInterview();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle
            className="font-[var(--font-headline)] text-xl"
            style={{ fontFamily: 'var(--font-headline, Cormorant Garamond, serif)' }}
          >
            Preparing Your Interview
          </DialogTitle>
          <DialogDescription className="mt-1">
            A few things help us craft the best questions for your project.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading ? (
            <LoadingDots />
          ) : diagnostic ? (
            <>
              {/* Readiness checklist */}
              <div className="space-y-3 mb-5">
                {/* Photos uploaded */}
                <div className="flex items-start gap-3">
                  <ChecklistIcon done={hasPhotos} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-folio-text-primary">
                      Photos uploaded
                    </p>
                    <p className="text-xs text-folio-text-tertiary mt-0.5">
                      {hasPhotos
                        ? `${diagnostic.summary.totalImages} photo${diagnostic.summary.totalImages !== 1 ? 's' : ''} in your project`
                        : 'Upload project photos to unlock personalized questions'}
                    </p>
                  </div>
                </div>

                {/* AI analysis */}
                <div className="flex items-start gap-3">
                  {classifying ? <SpinnerIcon /> : <ChecklistIcon done={hasAIAnalysis} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-folio-text-primary">
                      Photos analyzed
                    </p>
                    <p className="text-xs text-folio-text-tertiary mt-0.5">
                      {classifying
                        ? 'Analyzing your photos for colors, materials & style...'
                        : hasAIAnalysis
                        ? `${diagnostic.summary.classifiedImages} of ${diagnostic.summary.totalImages} analyzed for colors, materials & style`
                        : hasPhotos
                        ? 'Your photos need analysis to generate personalized questions'
                        : 'Available after photos are uploaded'}
                    </p>
                    {/* Manual analyze button — only when photos exist, not classified, not currently classifying */}
                    {hasPhotos && !hasAIAnalysis && !classifying && (
                      <button
                        onClick={handleClassify}
                        className="mt-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
                      >
                        Analyze now
                      </button>
                    )}
                  </div>
                </div>

                {/* Products tagged */}
                <div className="flex items-start gap-3">
                  {autoTagging ? <SpinnerIcon /> : <ChecklistIcon done={hasTaggedProducts} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-folio-text-primary">
                      Products tagged
                    </p>
                    <p className="text-xs text-folio-text-tertiary mt-0.5">
                      {autoTagging
                        ? 'Matching products to your photos...'
                        : hasTaggedProducts
                        ? `${diagnostic.summary.taggedImages} photo${diagnostic.summary.taggedImages !== 1 ? 's' : ''} with product tags for vendor attribution`
                        : canAutoTag
                        ? 'Tag products below to enable vendor attribution'
                        : 'Add products to your design board, then tag them on photos'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Auto-tag section — only shown when rooms can be auto-tagged */}
              {canAutoTag && !autoTagDone && (
                <div
                  className="rounded-xl border border-folio-border-subtle p-4 mb-5"
                  style={{ boxShadow: 'var(--neu-raised, 0 1px 3px rgba(0,0,0,0.06))' }}
                >
                  <p className="text-sm font-medium text-folio-text-primary mb-1">
                    Quick-tag from your design board
                  </p>
                  <p className="text-xs text-folio-text-tertiary mb-3">
                    We matched products from your board to untagged photos. Select rooms to tag automatically.
                  </p>

                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                    {diagnostic.rooms
                      .filter((r) => r.autoTaggable)
                      .map((room) => {
                        const checked = selectedRoomIds.has(room.roomId);
                        return (
                          <label
                            key={room.roomId}
                            className={`flex items-center gap-3 rounded-[10px] border px-3 py-2 text-sm cursor-pointer transition-all duration-150 ${
                              checked
                                ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                                : 'border-folio-border-subtle hover:border-[var(--accent)]/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRoom(room.roomId)}
                              className="sr-only"
                            />
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                checked
                                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                                  : 'border-[var(--text-tertiary)]'
                              }`}
                            >
                              {checked && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-folio-text-primary">
                                {room.roomName}
                              </span>
                              <span className="text-xs text-folio-text-tertiary ml-2">
                                {room.selections.withProductMatch} product{room.selections.withProductMatch !== 1 ? 's' : ''} &middot; {room.images.untagged} photo{room.images.untagged !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                  </div>

                  <button
                    onClick={handleAutoTag}
                    disabled={selectedRoomIds.size === 0 || autoTagging}
                    className="w-full rounded-[10px] px-4 py-2 text-sm font-medium text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--accent, #B8845C)',
                      boxShadow: 'var(--neu-raised, 0 1px 3px rgba(0,0,0,0.1))',
                    }}
                  >
                    {autoTagging
                      ? 'Tagging products...'
                      : `Tag ${selectedRoomIds.size} room${selectedRoomIds.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              )}

              {/* Auto-tag success */}
              {autoTagDone && (
                <div
                  className="rounded-xl border border-[var(--accent)]/20 p-3 mb-5 text-sm text-folio-text-secondary"
                  style={{ background: 'var(--accent-bg, rgba(184, 132, 92, 0.05))' }}
                >
                  Products tagged successfully. Your interview questions will now include product-specific context.
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                {isReady ? (
                  <>
                    <button
                      onClick={handleStartInterview}
                      className="flex-1 rounded-[10px] px-4 py-2.5 text-sm font-medium text-white transition-all duration-150"
                      style={{
                        background: 'var(--accent, #B8845C)',
                        boxShadow: 'var(--neu-raised, 0 1px 3px rgba(0,0,0,0.1))',
                      }}
                    >
                      Start Interview
                    </button>
                    <button
                      onClick={() => onOpenChange(false)}
                      className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-folio-text-secondary border border-folio-border-subtle hover:bg-surface-ground transition-all duration-150"
                    >
                      Not yet
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onOpenChange(false)}
                      disabled={classifying || autoTagging}
                      className="flex-1 rounded-[10px] px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 disabled:opacity-50"
                      style={{
                        background: 'var(--accent, #B8845C)',
                        boxShadow: 'var(--neu-raised, 0 1px 3px rgba(0,0,0,0.1))',
                      }}
                    >
                      {classifying ? 'Analyzing...' : 'Go back to project'}
                    </button>
                  </>
                )}
              </div>

              {/* Subtle hint when not ready */}
              {!isReady && !classifying && (
                <p className="text-xs text-folio-text-tertiary text-center mt-3">
                  Complete the steps above to unlock your personalized interview.
                </p>
              )}
            </>
          ) : (
            // No data / silent error — show gentle fallback
            <div className="py-6 text-center">
              <p className="text-sm text-folio-text-secondary mb-4">
                We couldn&apos;t check your project&apos;s readiness right now.
              </p>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-white transition-all duration-150"
                style={{
                  background: 'var(--accent, #B8845C)',
                  boxShadow: 'var(--neu-raised, 0 1px 3px rgba(0,0,0,0.1))',
                }}
              >
                Go back to project
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
