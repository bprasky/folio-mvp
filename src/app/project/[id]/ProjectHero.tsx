'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { FaInstagram, FaChevronDown } from 'react-icons/fa';
import { MdDownload, MdCampaign } from 'react-icons/md';
import OverviewModal from './OverviewModal';
import { CampaignWizard } from '@/components/instagram/CampaignWizard';

interface Project {
  id: string;
  title: string;
  stage: string;
  projectType: string;
  clientType: string;
  budgetBand: string;
  city?: string | null;
  regionState?: string | null;
  category?: string | null;
  description?: string | null;
  isPublic: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectImage {
  id: string;
  url: string;
  name?: string | null;
}

interface ProjectHeroProps {
  project: Project;
  images?: ProjectImage[];
  expandedBlocks?: any; // ProjectPost.expandedBlocks
  /** Viewer owns this project. Gates controls whose destination is owner-only. */
  isOwner?: boolean;
}

export default function ProjectHero({
  project,
  images = [],
  expandedBlocks,
  isOwner = false,
}: ProjectHeroProps) {
  const router = useRouter();
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show Instagram export if project is published
  const canExportToInstagram = project.isPublic && project.publishedAt && images.length > 0;
  // The export editor redirects anyone who is not the owner, so a publication
  // check cannot gate a control that navigates there.
  const canExport = canExportToInstagram && isOwner;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowShareDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <section className="relative w-full ridge-card ridge-card-lg overflow-hidden h-56 md:h-64 mx-4 mt-4">
        {/* Content */}
        <div className="absolute left-6 bottom-6 right-20">
          <h1 className="folio-h1 font-serif italic tracking-tight mb-2 text-folio-text-primary">
            {project.title}
          </h1>
          <p className="mt-1 folio-body text-folio-text-secondary">
            {project.category || 'Uncategorized'}
          </p>
        </div>

        {/* Action Buttons (top-right) */}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {/* Share to Instagram Dropdown */}
          {canExportToInstagram && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowShareDropdown(!showShareDropdown)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-canvas hover:bg-surface-ground border border-folio-border-subtle shadow-sm transition folio-ui font-medium text-folio-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                aria-label="Share to Instagram"
              >
                <FaInstagram className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
                <FaChevronDown className="w-3 h-3" />
              </button>

              {/* Dropdown Menu */}
              {showShareDropdown && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-surface-canvas border border-folio-border-subtle shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowCampaignWizard(true);
                        setShowShareDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-surface-ground flex items-start gap-3 transition"
                    >
                      <MdCampaign className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-folio-text-primary text-sm">Instagram Campaign</div>
                        <div className="text-xs text-folio-text-secondary mt-0.5">
                          Generate 8-12 posts with room spotlights
                        </div>
                      </div>
                    </button>
                    {canExport && (
                      <button
                        onClick={() => {
                          setShowShareDropdown(false);
                          router.push(`/designer/projects/${project.id}/instagram`);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-surface-ground flex items-start gap-3 transition"
                      >
                        <MdDownload className="w-5 h-5 text-folio-text-secondary flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-folio-text-primary text-sm">Quick Export</div>
                          <div className="text-xs text-folio-text-secondary mt-0.5">
                            Single carousel with selected images
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kebab Menu */}
          <button
            onClick={() => setShowOverviewModal(true)}
            className="inline-flex items-center justify-center rounded-full bg-surface-canvas hover:bg-surface-ground border border-folio-border-subtle shadow-sm transition h-9 w-9 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            aria-label="Project overview menu"
          >
            <HiOutlineDotsHorizontal className="h-5 w-5 text-folio-text-primary" />
          </button>
        </div>
      </section>

      {/* Overview Modal */}
      <OverviewModal
        open={showOverviewModal}
        onClose={() => setShowOverviewModal(false)}
        project={project}
      />

      {/* Campaign Wizard Modal */}
      {canExportToInstagram && showCampaignWizard && (
        <CampaignWizard
          projectId={project.id}
          projectTitle={project.title}
          onClose={() => setShowCampaignWizard(false)}
        />
      )}
    </>
  );
}
