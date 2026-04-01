'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import type { SourcebookEntry } from '@/types/sourcebook';

interface SourcebookCardProps {
  entry: SourcebookEntry;
  onEditNotes: (entry: SourcebookEntry) => void;
  onArchive: (productId: string, archived: boolean) => void;
  onUseInProject: (entry: SourcebookEntry) => void;
}

export default function SourcebookCard({
  entry,
  onEditNotes,
  onArchive,
  onUseInProject,
}: SourcebookCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const uniqueProjects = entry.projects.reduce((acc, p) => {
    if (!acc.find(x => x.projectId === p.projectId)) acc.push(p);
    return acc;
  }, [] as typeof entry.projects);

  return (
    <RidgeCard padding="none" className={entry.archived ? 'opacity-60' : ''}>
      <div className="flex gap-4 p-4 sm:p-5">
        {/* Product Image */}
        <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-[var(--bg-elevated)]">
          {entry.productImageUrl ? (
            <Image
              src={entry.productImageUrl}
              alt={entry.productName}
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)] text-xs">
              No image
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
                {entry.productName}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {[entry.productBrand, entry.productCategory].filter(Boolean).join(' · ')}
              </p>
            </div>

            {/* More menu */}
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="More actions"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-[var(--border-subtle)] py-1">
                  <button
                    onClick={() => { onEditNotes(entry); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    {entry.notes ? 'Edit Notes' : 'Add Notes'}
                  </button>
                  <button
                    onClick={() => { onUseInProject(entry); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Use in Another Project
                  </button>
                  <button
                    onClick={() => { onArchive(entry.productId, !entry.archived); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    {entry.archived ? 'Unarchive' : 'Archive'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Project usage */}
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            <span className="text-[var(--text-tertiary)]">Used in: </span>
            {uniqueProjects.length > 0 ? (
              uniqueProjects.map((p, i) => (
                <span key={p.projectId}>
                  <Link
                    href={`/designer/projects/${p.projectId}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {p.projectTitle}
                  </Link>
                  {i < uniqueProjects.length - 1 ? ', ' : ''}
                </span>
              ))
            ) : (
              <span>—</span>
            )}
            {uniqueProjects.length > 0 && (
              <span className="text-[var(--text-tertiary)]">
                {' '}({uniqueProjects.length} {uniqueProjects.length === 1 ? 'project' : 'projects'})
              </span>
            )}
          </div>

          {/* Last used */}
          <div className="mt-1 text-sm text-[var(--text-tertiary)]">
            Last used: {formatDate(entry.lastUsedAt)}
          </div>

          {/* Notes */}
          {entry.notes && (
            <div className="mt-2 text-sm text-[var(--text-secondary)] italic line-clamp-2">
              &ldquo;{entry.notes}&rdquo;
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="ridge"
              size="sm"
              onClick={() => onUseInProject(entry)}
            >
              Use in Project
            </Button>
            <Button
              variant="ridge"
              size="sm"
              onClick={() => onEditNotes(entry)}
            >
              {entry.notes ? 'Edit Notes' : 'Add Notes'}
            </Button>
            {uniqueProjects.length > 0 && (
              <Link href={`/designer/projects/${uniqueProjects[0].projectId}`}>
                <Button variant="ridge" size="sm">
                  View in Projects
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </RidgeCard>
  );
}
