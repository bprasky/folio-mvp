'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EditableParagraph from './EditableParagraph';
import SectionFeedback from './SectionFeedback';
import type { SectionOverride, SectionOverrideField, SectionHistoryEntry } from '@/lib/posting/editingTypes';
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
    pullQuote?: string;
  }>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="folio-h3 text-[var(--text-primary)]">Edit Article</h2>
        <span className="folio-meta text-[var(--text-tertiary)]">
          Click any text to edit
        </span>
      </div>

      {/* Lead */}
      {lead && (
        <div className="space-y-3 pb-6 border-b border-[var(--border-default)]">
          <label className="folio-meta font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
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
              <label className="folio-meta font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Subtitle
              </label>
              <EditableParagraph
                text={lead.deck || ''}
                isEdited={isEdited(-1, 0, 'deck')}
                isEditing={isEditing(-1, 0, 'deck')}
                placeholder="Article subtitle..."
                className="folio-body text-[var(--text-secondary)]"
                onStartEdit={() => setEditingField({ chapterIndex: -1, paragraphIndex: 0, field: 'deck' })}
                onSave={(t) => handleSave(-1, 0, 'deck', t)}
                onCancel={() => setEditingField(null)}
                onRevert={() => handleRevert(-1, 0, 'deck')}
              />
            </>
          )}
        </div>
      )}

      {/* Gallery Chapters */}
      {chapters.map((chapter, ci) => (
        <div key={ci} className="space-y-4 pb-6 border-b border-[var(--border-default)] last:border-b-0">
          {/* Chapter title */}
          {chapter.title !== undefined && (
            <div>
              <label className="folio-meta font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
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
                  <div key={imgId} className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-[var(--bg-base)]">
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
                <span className="flex-shrink-0 w-16 h-16 rounded bg-[var(--bg-base)] flex items-center justify-center folio-meta text-[var(--text-tertiary)]">
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
                  className="folio-body text-[var(--text-primary)] leading-relaxed"
                  onStartEdit={() => setEditingField({ chapterIndex: ci, paragraphIndex: pi, field: 'body' })}
                  onSave={(t) => handleSave(ci, pi, 'body', t)}
                  onCancel={() => setEditingField(null)}
                  onRevert={() => handleRevert(ci, pi, 'body')}
                />
              ))}
            </div>
          )}

          {/* Pull quote */}
          {chapter.pullQuote && (
            <div className="pl-4 border-l-2 border-[var(--accent)]">
              <label className="folio-meta font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1 block">
                Pull Quote
              </label>
              <EditableParagraph
                text={chapter.pullQuote}
                isEdited={isEdited(ci, 0, 'pullQuote')}
                isEditing={isEditing(ci, 0, 'pullQuote')}
                as="blockquote"
                className="folio-body italic text-[var(--text-secondary)]"
                onStartEdit={() => setEditingField({ chapterIndex: ci, paragraphIndex: 0, field: 'pullQuote' })}
                onSave={(t) => handleSave(ci, 0, 'pullQuote', t)}
                onCancel={() => setEditingField(null)}
                onRevert={() => handleRevert(ci, 0, 'pullQuote')}
              />
            </div>
          )}

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
        <p className="folio-body text-[var(--text-tertiary)] text-center py-8">
          No article content yet. Generate an article first.
        </p>
      )}
    </div>
  );
}
