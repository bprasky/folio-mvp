'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Share2, Plus } from 'lucide-react';
import { FaChevronDown } from 'react-icons/fa';
import { MdDownload, MdCampaign } from 'react-icons/md';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import OverviewModal from './OverviewModal';
import ExportSpecModal from './ExportSpecModal';
import InstagramExportModal from '@/components/instagram/InstagramExportModal';
import { CampaignWizard } from '@/components/instagram/CampaignWizard';
import { toast } from 'sonner';
import type { EditorialState } from '@/lib/editorial/getEditorialState';

function editorialStatusLabel(state: EditorialState): string {
  if (state === 'PUBLISHED') return 'Published';
  if (state === 'EMPTY') return 'Drafts';
  return 'In progress';
}

function editorialStatusDotClass(state: EditorialState): string {
  if (state === 'PUBLISHED') return 'bg-[#6FA67A]';
  if (state === 'EMPTY') return 'bg-folio-text-tertiary';
  return 'bg-folio-gold-ornament';
}

function formatMonthYear(date: Date | string): string {
  return format(new Date(date), 'MMM yyyy');
}

function formatRelative(date: Date | string): string {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return formatDistanceToNowStrict(d, { addSuffix: true });
  }
  return format(d, 'MMM d');
}

const Sep = () => (
  <span className="inline-block w-1 h-1 rounded-full bg-folio-text-tertiary" aria-hidden />
);

interface ProjectHeaderProps {
  project: {
    id: string;
    title: string;
    category?: string | null;
    createdAt: Date;
    updatedAt: Date;
    rooms: Array<{ selections: unknown[] }>;
    isPublic: boolean;
    publishedAt?: Date | null;
  };
  editorialState: EditorialState;
  images?: Array<{ id: string; url: string; name?: string | null }>;
  expandedBlocks?: unknown;
}

export default function ProjectHeader({
  project,
  editorialState,
  images = [],
  expandedBlocks,
}: ProjectHeaderProps) {
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canShare = project.isPublic && !!project.publishedAt && images.length > 0;
  const sLabel = editorialStatusLabel(editorialState);
  const dotClass = editorialStatusDotClass(editorialState);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowShareDropdown(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  const handleExport = async (
    scope: 'current' | 'all',
    format: 'xlsx' | 'pdf',
    roomId?: string,
  ) => {
    try {
      const params = new URLSearchParams({ scope, format });
      if (roomId) {
        params.set('roomId', roomId);
      }

      const response = await fetch(
        `/api/projects/${project.id}/export-spec?${params.toString()}`,
        { method: 'POST' },
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `folio-spec-${project.id}-${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Export ready');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export spec');
      throw error;
    }
  };

  return (
    <>
      <header className="grid grid-cols-[1fr_auto] items-end gap-8 pb-6">
        <div>
          {/* Status + category badges */}
          <div className="inline-flex items-center gap-2.5 mb-3.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-folio-surface-elevated text-folio-text-secondary text-[11px] font-medium tracking-[0.08em] uppercase">
              <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
              {sLabel}
            </span>
            {project.category && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-folio-border-subtle text-folio-text-secondary text-[11px] font-medium tracking-[0.08em] uppercase">
                {project.category}
              </span>
            )}
          </div>

          {/* H1 */}
          <h1 className="font-headline italic font-medium text-[72px] leading-none tracking-[-0.015em] text-folio-text-primary">
            {project.title}
          </h1>

          {/* Meta row — room/item counts intentionally omitted: the progress
              tracker's stepper is the single owner of project counts. */}
          <div className="mt-4 flex items-center gap-4 text-sm text-folio-text-secondary">
            <span>Started {formatMonthYear(project.createdAt)}</span>
            <Sep />
            <span>Last edit {formatRelative(project.updatedAt)}</span>
          </div>
        </div>

        {/* Action cluster */}
        <div className="flex items-center gap-2.5">
          {canShare ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowShareDropdown(v => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-folio-border-subtle text-folio-text-secondary text-sm font-medium transition-colors duration-[220ms] hover:text-folio-text-primary hover:border-folio-border-strong focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              >
                <Share2 className="w-4 h-4" />
                Share
                <FaChevronDown className="w-3 h-3" />
              </button>
              {showShareDropdown && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-surface-canvas border border-folio-border-subtle shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowCampaignWizard(true);
                        setShowShareDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-surface-ground flex items-start gap-3 transition-colors duration-150"
                    >
                      <MdCampaign className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-folio-text-primary text-sm">
                          Instagram campaign
                        </div>
                        <div className="text-xs text-folio-text-secondary mt-0.5">
                          Generate 8–12 posts with room spotlights
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setShowInstagramModal(true);
                        setShowShareDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-surface-ground flex items-start gap-3 transition-colors duration-150"
                    >
                      <MdDownload className="w-5 h-5 text-folio-text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-folio-text-primary text-sm">
                          Quick export
                        </div>
                        <div className="text-xs text-folio-text-secondary mt-0.5">
                          Single carousel with selected images
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-folio-border-subtle text-folio-text-secondary text-sm font-medium transition-colors duration-[220ms] hover:text-folio-text-primary hover:border-folio-border-strong focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
              <Share2 className="w-4 h-4" />
              Share
            </button>
          )}

          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-folio-border-subtle text-folio-text-secondary text-sm font-medium transition-colors duration-[220ms] hover:text-folio-text-primary hover:border-folio-border-strong focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          >
            Export spec
          </button>

          <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-folio-text-primary text-white text-sm font-medium transition-colors duration-[220ms] hover:bg-[#2a2a28] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
            <Plus className="w-4 h-4" />
            Add tile
          </button>

          <button
            onClick={() => setShowOverviewModal(true)}
            aria-label="More actions"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-folio-border-subtle text-folio-text-secondary transition-colors duration-[220ms] hover:text-folio-text-primary hover:border-folio-border-strong focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      <OverviewModal
        open={showOverviewModal}
        onClose={() => setShowOverviewModal(false)}
        project={project}
      />

      <ExportSpecModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        projectId={project.id}
        onExport={handleExport}
      />

      {canShare && (
        <InstagramExportModal
          isOpen={showInstagramModal}
          onClose={() => setShowInstagramModal(false)}
          projectId={project.id}
          projectTitle={project.title}
          images={images}
          expandedBlocks={expandedBlocks}
        />
      )}

      {canShare && showCampaignWizard && (
        <CampaignWizard
          projectId={project.id}
          projectTitle={project.title}
          onClose={() => setShowCampaignWizard(false)}
        />
      )}
    </>
  );
}
