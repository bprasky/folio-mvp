'use client';

// ============================================================================
// Editing state for the Story Format, carried by context rather than props.
//
// StoryRenderer serves TWO surfaces from one component tree: the live published
// article at /p/[slug], and the owner's draft in the staging panel. Only the
// second one edits.
//
// Context is what keeps that safe. The public page mounts no provider, so
// `useStoryEdit()` returns null and every consumer renders exactly the markup it
// rendered before this existed — no edit affordances, no owner checks scattered
// through the tree, no prop threaded through six tile layouts that a future
// call site could forget to pass.
//
// The save/revert logic here is lifted from the old EditableArticle, which this
// replaces. It is not a second implementation of it.
// ============================================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PullQuoteSelection } from '@/lib/posting/schemas';
import { needsRoomTeaserPreparation } from '@/lib/posting/folioLines';
import { useRouter } from 'next/navigation';
import type {
  SectionHistoryEntry,
  SectionOverride,
  SectionOverrideField,
} from '@/lib/posting/editingTypes';

/** Which single field is open for editing right now. */
export type EditingField = {
  chapterIndex: number;
  paragraphIndex: number;
  field: SectionOverrideField;
} | null;

export interface StoryEditValue {
  projectId: string;
  /** True when a given field has a designer edit on top of the generated text. */
  isEdited: (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) => boolean;
  /** True when a given field is the one currently open. */
  isEditing: (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) => boolean;
  openEditor: (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) => void;
  closeEditor: () => void;
  save: (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField, text: string) => Promise<void>;
  revert: (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) => Promise<void>;
  /** Re-read the draft after a change that the server owns (pull quote cycling). */
  refresh: () => void;
  /** True when a chapter has a previous generation to undo back to. */
  hasHistory: (chapterIndex: number) => boolean;
  /** True while any field is open — tiles suppress their own click handling. */
  anyFieldOpen: boolean;
  teasersPreparing?: boolean;
}

const StoryEditContext = createContext<StoryEditValue | null>(null);

/**
 * Editing state for the story tree. Returns null on the published article,
 * which is the signal for every consumer to render read-only.
 */
export function useStoryEdit(): StoryEditValue | null {
  return useContext(StoryEditContext);
}

export function StoryEditProvider({
  projectId,
  initialOverrides,
  sectionHistory = [],
  chapters = [],
  children,
}: {
  projectId: string;
  initialOverrides: SectionOverride[];
  sectionHistory?: SectionHistoryEntry[];
  chapters?: Array<{ kind?: string; body?: string[]; pullQuote?: string | PullQuoteSelection | null }>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<SectionOverride[]>(initialOverrides);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [teasersPreparing, setTeasersPreparing] = useState(false);
  const [teaserError, setTeaserError] = useState<string | null>(null);
  const attemptedPreparation = useRef<string | null>(null);
  const needsTeasers = chapters.some(needsRoomTeaserPreparation);
  const prepareTeasers = useCallback(async () => {
    setTeasersPreparing(true);
    setTeaserError(null);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quotes/backfill`, { method: 'POST' });
      if (!res.ok) throw new Error('Could not save the room options. Your article is unchanged.');
      router.refresh();
    } catch {
      setTeaserError('Could not save the room options. Your article is unchanged.');
    } finally {
      setTeasersPreparing(false);
    }
  }, [projectId, router]);
  useEffect(() => {
    if (!needsTeasers) { attemptedPreparation.current = null; return; }
    if (attemptedPreparation.current === projectId) return;
    attemptedPreparation.current = projectId;
    void prepareTeasers();
  }, [needsTeasers, prepareTeasers, projectId]);

  const isEdited = useCallback(
    (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) =>
      overrides.some(
        (o) => o.chapterIndex === chapterIndex && o.paragraphIndex === paragraphIndex && o.field === field,
      ),
    [overrides],
  );

  const isEditing = useCallback(
    (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) =>
      editingField?.chapterIndex === chapterIndex &&
      editingField?.paragraphIndex === paragraphIndex &&
      editingField?.field === field,
    [editingField],
  );

  const openEditor = useCallback(
    (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) =>
      setEditingField({ chapterIndex, paragraphIndex, field }),
    [],
  );

  const closeEditor = useCallback(() => setEditingField(null), []);

  const save = useCallback(
    async (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField, text: string) => {
      const res = await fetch(`/api/posting/project/${projectId}/sections/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, paragraphIndex, field, editedBody: text }),
      });
      if (!res.ok) throw new Error('Failed to save edit');
      const data = await res.json();
      setOverrides(data.overrides);
      setEditingField(null);
      router.refresh();
    },
    [projectId, router],
  );

  const revert = useCallback(
    async (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) => {
      const res = await fetch(`/api/posting/project/${projectId}/sections/override`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, paragraphIndex, field }),
      });
      if (!res.ok) throw new Error('Failed to revert');
      const data = await res.json();
      setOverrides(data.overrides);
      router.refresh();
    },
    [projectId, router],
  );

  const refresh = useCallback(() => router.refresh(), [router]);

  const hasHistory = useCallback(
    (chapterIndex: number) =>
      sectionHistory.some((h) => h.chapterIndex === chapterIndex && h.versions.length > 0),
    [sectionHistory],
  );

  const value = useMemo<StoryEditValue>(
    () => ({
      projectId,
      isEdited,
      isEditing,
      openEditor,
      closeEditor,
      save,
      revert,
      refresh,
      hasHistory,
      anyFieldOpen: editingField !== null,
      teasersPreparing,
    }),
    [projectId, isEdited, isEditing, openEditor, closeEditor, save, revert, refresh, hasHistory, editingField, teasersPreparing],
  );

  return <StoryEditContext.Provider value={value}>
    {teaserError && <p role="alert" className="folio-meta p-4 text-folio-text-primary">{teaserError} <button type="button" onClick={prepareTeasers} disabled={teasersPreparing} className="underline">Retry saving options</button></p>}
    {children}
  </StoryEditContext.Provider>;
}

/**
 * Wrapper for any editable region inside a tile that is itself clickable.
 *
 * The room tiles are `role="button"` and expand on click. Without this, clicking
 * into a paragraph to edit it also collapses the room out from under the cursor.
 * Wrapping the editing regions once — rather than calling stopPropagation on
 * each leaf — means a field added later cannot forget to opt out.
 */
export function StoryEditRegion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-story-edit=""
      className={className}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
