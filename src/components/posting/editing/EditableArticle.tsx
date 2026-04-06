'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EditableParagraph from './EditableParagraph';
import SectionFeedback from './SectionFeedback';
import type { SectionOverride, SectionOverrideField, SectionHistoryEntry } from '@/lib/posting/editingTypes';
import type { PullQuoteSelection } from '@/lib/posting/schemas';
import { isPullQuoteSelection, getSelectedPullQuoteText } from '@/lib/posting/schemas';
import SafeImage from '@/components/SafeImage';

interface ProjectImage {
  id: string;
  url: string;
  name?: string;
  room?: string;
}

interface EditableArticleProps {
  projectId: string;
  blocks: Record<string, any>;
  overrides: SectionOverride[];
  sectionHistory: SectionHistoryEntry[];
  images: ProjectImage[];
}

type EditingField = {
  chapterIndex: number;
  paragraphIndex: number;
  field: SectionOverrideField;
} | null;

/** Inline pull quote picker — cycle through alternatives, remove, or add */
function PullQuotePicker({
  pullQuote,
  chapterIndex,
  projectId,
  isEdited,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onRevert,
  onUpdate,
}: {
  pullQuote: string | PullQuoteSelection | null | undefined;
  chapterIndex: number;
  projectId: string;
  isEdited: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (text: string) => void;
  onCancel: () => void;
  onRevert: () => void;
  onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);

  // Normalize to get current text, context, and alternatives
  const isSelection = isPullQuoteSelection(pullQuote);
  const selectedText = typeof pullQuote === 'string' ? pullQuote : pullQuote?.selected?.text ?? null;
  const selectedContext = isSelection ? pullQuote.selected?.context : undefined;
  const alternatives = isSelection ? pullQuote.alternatives : [];
  const hasAlternatives = alternatives.length > 1;

  // Find current index in alternatives
  const currentIndex = selectedText
    ? alternatives.findIndex(a => a.text === selectedText)
    : -1;

  const handleCycle = async (direction: 1 | -1) => {
    if (!hasAlternatives || saving) return;
    const nextIndex = ((currentIndex === -1 ? 0 : currentIndex) + direction + alternatives.length) % alternatives.length;
    const nextText = alternatives[nextIndex].text;

    setSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, selectedText: nextText }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, selectedText: null }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!alternatives.length || saving) return;
    const firstAlt = alternatives[0];
    setSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/sections/pull-quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, selectedText: firstAlt.text }),
      });
      if (res.ok) onUpdate();
    } finally {
      setSaving(false);
    }
  };

  // Section has a selected pull quote — show quote, attribution, then controls below
  if (selectedText) {
    return (
      <div className="py-2">
        {/* Quote text — Cormorant Garamond italic, editable */}
        <EditableParagraph
          text={selectedText}
          isEdited={isEdited}
          isEditing={isEditing}
          as="blockquote"
          className="font-[var(--font-headline)] text-lg md:text-xl italic leading-relaxed text-folio-text-secondary"
          onStartEdit={onStartEdit}
          onSave={onSave}
          onCancel={onCancel}
          onRevert={onRevert}
        />

        {/* Attribution line */}
        {selectedContext && (
          <p className="mt-2 folio-meta tracking-wide uppercase text-folio-text-tertiary">
            — {selectedContext}
          </p>
        )}

        {/* Controls — float beneath like secondary metadata */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {hasAlternatives && (
              <>
                <button
                  onClick={() => handleCycle(-1)}
                  disabled={saving}
                  className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors p-0.5"
                  title="Previous quote"
                  aria-label="Previous pull quote"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <span className="folio-meta text-folio-text-tertiary tabular-nums">
                  {currentIndex >= 0 ? currentIndex + 1 : 1} of {alternatives.length}
                </span>
                <button
                  onClick={() => handleCycle(1)}
                  disabled={saving}
                  className="text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors p-0.5"
                  title="Next quote"
                  aria-label="Next pull quote"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </>
            )}
          </div>
          <button
            onClick={handleRemove}
            disabled={saving}
            className="flex items-center gap-1 folio-meta text-folio-text-tertiary hover:text-folio-text-secondary disabled:opacity-40 transition-colors"
            title="Remove pull quote"
            aria-label="Remove pull quote"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Remove
          </button>
        </div>
      </div>
    );
  }

  // No selected pull quote but alternatives exist — offer to add one
  if (alternatives.length > 0) {
    return (
      <div className="py-2">
        <button
          onClick={handleAdd}
          disabled={saving}
          className="folio-meta text-[var(--accent)] hover:text-folio-text-primary disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3V11M3 7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Add pull quote
        </button>
      </div>
    );
  }

  // No pull quote and no alternatives — nothing to show
  return null;
}

export default function EditableArticle({
  projectId,
  blocks,
  overrides: initialOverrides,
  sectionHistory,
  images,
}: EditableArticleProps) {
  const router = useRouter();
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [overrides, setOverrides] = useState<SectionOverride[]>(initialOverrides);

  const imageMap = new Map(images.map((img) => [img.id, img]));

  const hasHistory = (ci: number) =>
    sectionHistory.some((h) => h.chapterIndex === ci && h.versions.length > 0);

  const isEditing = (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) =>
    editingField?.chapterIndex === chapterIndex &&
    editingField?.paragraphIndex === paragraphIndex &&
    editingField?.field === field;

  const isEdited = (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField) =>
    overrides.some(
      (o) => o.chapterIndex === chapterIndex && o.paragraphIndex === paragraphIndex && o.field === field
    );

  const handleSave = useCallback(
    async (chapterIndex: number, paragraphIndex: number, field: SectionOverrideField, editedBody: string) => {
      const res = await fetch(`/api/posting/project/${projectId}/sections/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, paragraphIndex, field, editedBody }),
      });
      if (!res.ok) throw new Error('Failed to save edit');
      const data = await res.json();
      setOverrides(data.overrides);
      setEditingField(null);
      router.refresh();
    },
    [projectId, router]
  );

  const handleRevert = useCallback(
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
    [projectId, router]
  );

  const lead = blocks.lead as { kicker?: string; deck?: string; title?: string } | undefined;
  const chapters = (blocks.galleryChapters ?? []) as Array<{
    title?: string;
    body?: string[];
    imageIds?: string[];
    pullQuote?: string | PullQuoteSelection | null;
  }>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="folio-h3 text-folio-text-primary">Edit Article</h2>
        <span className="folio-meta text-folio-text-tertiary">
          Click any text to edit
        </span>
      </div>

      {/* Lead */}
      {lead && (
        <div className="space-y-3 pb-6 border-b border-folio-border-subtle">
          <label className="folio-meta font-medium text-folio-text-tertiary uppercase tracking-wider">
            Headline
          </label>
          <EditableParagraph
            text={lead.kicker || lead.title || ''}
            isEdited={isEdited(-1, 0, 'kicker')}
            isEditing={isEditing(-1, 0, 'kicker')}
            placeholder="Article headline..."
            as="h2"
            className="folio-h2"
            onStartEdit={() => setEditingField({ chapterIndex: -1, paragraphIndex: 0, field: 'kicker' })}
            onSave={(t) => handleSave(-1, 0, 'kicker', t)}
            onCancel={() => setEditingField(null)}
            onRevert={() => handleRevert(-1, 0, 'kicker')}
          />
          {lead.deck !== undefined && (
            <>
              <label className="folio-meta font-medium text-folio-text-tertiary uppercase tracking-wider">
                Subtitle
              </label>
              <EditableParagraph
                text={lead.deck || ''}
                isEdited={isEdited(-1, 0, 'deck')}
                isEditing={isEditing(-1, 0, 'deck')}
                placeholder="Article subtitle..."
                className="folio-body text-folio-text-secondary"
                onStartEdit={() => setEditingField({ chapterIndex: -1, paragraphIndex: 0, field: 'deck' })}
                onSave={(t) => handleSave(-1, 0, 'deck', t)}
                onCancel={() => setEditingField(null)}
                onRevert={() => handleRevert(-1, 0, 'deck')}
              />
            </>
          )}
        </div>
      )}

      {/* Introduction */}
      {blocks.introduction && Array.isArray(blocks.introduction) && (blocks.introduction as string[]).length > 0 && (
        <div className="space-y-3 pb-6 border-b border-folio-border-subtle">
          <label className="folio-meta font-medium text-folio-text-tertiary uppercase tracking-wider">
            Introduction
          </label>
          {(blocks.introduction as string[]).map((para: string, pi: number) => (
            <EditableParagraph
              key={pi}
              text={para}
              isEdited={isEdited(-2, pi, 'introduction')}
              isEditing={isEditing(-2, pi, 'introduction')}
              placeholder="Introduction paragraph..."
              className="folio-body text-folio-text-primary"
              onStartEdit={() => setEditingField({ chapterIndex: -2, paragraphIndex: pi, field: 'introduction' })}
              onSave={(t) => handleSave(-2, pi, 'introduction', t)}
              onCancel={() => setEditingField(null)}
              onRevert={() => handleRevert(-2, pi, 'introduction')}
            />
          ))}
        </div>
      )}

      {/* Gallery Chapters */}
      {chapters.map((chapter, ci) => (
        <div key={ci} className="space-y-4 pb-6 border-b border-folio-border-subtle last:border-b-0">
          {/* Chapter title */}
          {chapter.title !== undefined && (
            <div>
              <label className="folio-meta font-medium text-folio-text-tertiary uppercase tracking-wider">
                Section {ci + 1}
              </label>
              <EditableParagraph
                text={chapter.title || ''}
                isEdited={isEdited(ci, 0, 'title')}
                isEditing={isEditing(ci, 0, 'title')}
                placeholder="Section title..."
                as="h3"
                className="folio-h3"
                onStartEdit={() => setEditingField({ chapterIndex: ci, paragraphIndex: 0, field: 'title' })}
                onSave={(t) => handleSave(ci, 0, 'title', t)}
                onCancel={() => setEditingField(null)}
                onRevert={() => handleRevert(ci, 0, 'title')}
              />
            </div>
          )}

          {/* Image thumbnails */}
          {chapter.imageIds && chapter.imageIds.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-1">
              {chapter.imageIds.slice(0, 6).map((imgId) => {
                const img = imageMap.get(imgId);
                if (!img) return null;
                return (
                  <div key={imgId} className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-surface-canvas">
                    <SafeImage
                      src={img.url}
                      alt={img.name || ''}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              })}
              {chapter.imageIds.length > 6 && (
                <span className="flex-shrink-0 w-16 h-16 rounded bg-surface-canvas flex items-center justify-center folio-meta text-folio-text-tertiary">
                  +{chapter.imageIds.length - 6}
                </span>
              )}
            </div>
          )}

          {/* Body paragraphs */}
          {chapter.body && chapter.body.length > 0 && (
            <div className="space-y-3">
              {chapter.body.map((para, pi) => (
                <EditableParagraph
                  key={`${ci}-${pi}`}
                  text={para}
                  isEdited={isEdited(ci, pi, 'body')}
                  isEditing={isEditing(ci, pi, 'body')}
                  placeholder="Paragraph text..."
                  className="folio-body text-folio-text-primary leading-relaxed"
                  onStartEdit={() => setEditingField({ chapterIndex: ci, paragraphIndex: pi, field: 'body' })}
                  onSave={(t) => handleSave(ci, pi, 'body', t)}
                  onCancel={() => setEditingField(null)}
                  onRevert={() => handleRevert(ci, pi, 'body')}
                />
              ))}
            </div>
          )}

          {/* Pull quote picker */}
          <PullQuotePicker
            pullQuote={chapter.pullQuote}
            chapterIndex={ci}
            projectId={projectId}
            isEdited={isEdited(ci, 0, 'pullQuote')}
            isEditing={isEditing(ci, 0, 'pullQuote')}
            onStartEdit={() => setEditingField({ chapterIndex: ci, paragraphIndex: 0, field: 'pullQuote' })}
            onSave={(t) => handleSave(ci, 0, 'pullQuote', t)}
            onCancel={() => setEditingField(null)}
            onRevert={() => handleRevert(ci, 0, 'pullQuote')}
            onUpdate={() => router.refresh()}
          />

          {/* Section feedback + regenerate */}
          <SectionFeedback
            projectId={projectId}
            chapterIndex={ci}
            hasHistory={hasHistory(ci)}
            onRegenerated={() => router.refresh()}
          />
        </div>
      ))}

      {chapters.length === 0 && (
        <p className="folio-body text-folio-text-tertiary text-center py-8">
          No article content yet. Generate an article first.
        </p>
      )}
    </div>
  );
}
