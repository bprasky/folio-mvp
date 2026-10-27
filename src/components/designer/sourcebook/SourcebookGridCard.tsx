'use client';

import { useState, useRef, useEffect } from 'react';
import Image from '@/components/FolioImage';
import type { SourcebookEntry } from '@/types/sourcebook';

interface SourcebookGridCardProps {
  entry: SourcebookEntry;
  onEditNotes: (entry: SourcebookEntry) => void;
  onArchive: (productId: string, archived: boolean) => void;
  onUseInProject: (entry: SourcebookEntry) => void;
  onRequestSample: (entry: SourcebookEntry) => void;
  onRequestQuote: (entry: SourcebookEntry) => void;
  onContactRep: (entry: SourcebookEntry) => void;
}

export default function SourcebookGridCard({
  entry,
  onEditNotes,
  onArchive,
  onUseInProject,
  onRequestSample,
  onRequestQuote,
  onContactRep,
}: SourcebookGridCardProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const uniqueProjects = entry.projects.reduce((acc, p) => {
    if (!acc.find(x => x.projectId === p.projectId)) acc.push(p);
    return acc;
  }, [] as typeof entry.projects);

  const { resolvedImage } = entry;

  // Build image style for project tag focal point
  const imageStyle: React.CSSProperties = resolvedImage.type === 'project' && resolvedImage.focalX != null && resolvedImage.focalY != null
    ? { objectPosition: `${resolvedImage.focalX * 100}% ${resolvedImage.focalY * 100}%` }
    : {};

  return (
    <div
      className={`
        rounded-xl overflow-hidden bg-[var(--surface-ground)] transition-all duration-200
        border border-[rgba(0,0,0,0.06)]
        hover:bg-[rgba(250,249,246,0.82)] hover:border-[rgba(201,169,110,0.25)]
        hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)]
        ${entry.archived ? 'opacity-60' : ''}
      `}
    >
      {/* Image area */}
      <div className="relative" style={{ aspectRatio: '4 / 3' }}>
        {resolvedImage.type !== 'placeholder' && resolvedImage.url ? (
          <Image
            src={resolvedImage.url}
            alt={entry.productName}
            fill
            className="object-cover"
            style={imageStyle}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e8e4de 0%, #d4cfc6 100%)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
              <span className="text-[#999] text-lg">&#10022;</span>
            </div>
          </div>
        )}

        {/* Category badge */}
        {entry.productCategory && (
          <span className="absolute top-2 right-2 bg-[rgba(255,255,255,0.85)] rounded-md px-2 py-0.5 text-[var(--type-eyebrow)] text-[#888]">
            {entry.productCategory}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3.5 pt-3 pb-3.5">
        {/* Product name */}
        <h3 className="text-[var(--type-ui)] font-medium text-folio-text-primary truncate">
          {entry.productName}
        </h3>

        {/* Vendor line */}
        <p className="text-[var(--type-meta)] text-[var(--folio-gold-ornament)] truncate mt-0.5">
          {entry.productBrand || '\u00A0'}
        </p>

        {/* Metadata pills */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {uniqueProjects.length > 0 && (
            <span className="inline-block text-[var(--type-eyebrow)] bg-[rgba(0,0,0,0.04)] rounded px-1.5 py-0.5 text-folio-text-secondary">
              {uniqueProjects.length} {uniqueProjects.length === 1 ? 'project' : 'projects'}
            </span>
          )}
          <span className="inline-block text-[var(--type-eyebrow)] bg-[rgba(0,0,0,0.04)] rounded px-1.5 py-0.5 text-folio-text-secondary">
            Last: {formatDate(entry.lastUsedAt)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 mt-3 relative">
          <button
            type="button"
            onClick={() => onRequestQuote(entry)}
            className="flex-1 text-[var(--type-eyebrow)] py-1.5 rounded-md bg-transparent border border-[rgba(0,0,0,0.12)] text-folio-text-secondary cursor-pointer transition-all duration-150 hover:border-[rgba(201,169,110,0.4)] hover:text-[var(--folio-gold-ornament)]"
          >
            Quote
          </button>
          <button
            type="button"
            onClick={() => onRequestSample(entry)}
            className="flex-1 text-[var(--type-eyebrow)] py-1.5 rounded-md bg-transparent border border-[rgba(0,0,0,0.12)] text-folio-text-secondary cursor-pointer transition-all duration-150 hover:border-[rgba(201,169,110,0.4)] hover:text-[var(--folio-gold-ornament)]"
          >
            Sample
          </button>

          {/* More dropdown */}
          <div className="relative flex-1" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              className="w-full text-[var(--type-eyebrow)] py-1.5 rounded-md bg-transparent border border-[rgba(0,0,0,0.12)] text-folio-text-secondary cursor-pointer transition-all duration-150 hover:border-[rgba(201,169,110,0.4)] hover:text-[var(--folio-gold-ornament)]"
            >
              More &#9662;
            </button>

            {moreOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-20 w-48 bg-white rounded-lg shadow-lg border border-[rgba(0,0,0,0.08)] py-1">
                <button
                  type="button"
                  onClick={() => { onContactRep(entry); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-[var(--type-meta)] text-folio-text-primary hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                >
                  Contact Rep
                </button>
                <button
                  type="button"
                  onClick={() => { onUseInProject(entry); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-[var(--type-meta)] text-folio-text-primary hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                >
                  Use in Project
                </button>
                <button
                  type="button"
                  onClick={() => { onEditNotes(entry); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-[var(--type-meta)] text-folio-text-primary hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                >
                  {entry.notes ? 'Edit Notes' : 'Add Notes'}
                </button>
                <div className="border-t border-[rgba(0,0,0,0.06)] my-0.5" />
                <button
                  type="button"
                  onClick={() => { onArchive(entry.productId, !entry.archived); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-[var(--type-meta)] text-folio-text-primary hover:bg-[rgba(0,0,0,0.03)] transition-colors"
                >
                  {entry.archived ? 'Unarchive' : 'Archive'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
