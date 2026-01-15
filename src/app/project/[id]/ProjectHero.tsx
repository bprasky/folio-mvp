'use client';

import { useState } from 'react';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { FaInstagram } from 'react-icons/fa';
import OverviewModal from './OverviewModal';
import InstagramExportModal from '@/components/instagram/InstagramExportModal';

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
}

export default function ProjectHero({ project, images = [], expandedBlocks }: ProjectHeroProps) {
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);

  // Only show Instagram export if project is published
  const canExportToInstagram = project.isPublic && project.publishedAt && images.length > 0;

  return (
    <>
      <section className="relative w-full ridge-card ridge-card-lg overflow-hidden h-56 md:h-64 mx-4 mt-4">
        {/* Content */}
        <div className="absolute left-6 bottom-6 right-20">
          <h1 className="folio-h1 font-serif italic tracking-tight mb-2 text-[var(--text-primary)]">
            {project.title}
          </h1>
          <p className="mt-1 folio-body text-[var(--text-secondary)]">
            {project.category || 'Uncategorized'}
          </p>
        </div>

        {/* Action Buttons (top-right) */}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {/* Share to Instagram Button */}
          {canExportToInstagram && (
            <button
              onClick={() => setShowInstagramModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-base)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-sm transition folio-ui font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              aria-label="Share to Instagram"
            >
              <FaInstagram className="w-4 h-4" />
              <span className="hidden sm:inline">Share to Instagram</span>
            </button>
          )}

          {/* Kebab Menu */}
          <button
            onClick={() => setShowOverviewModal(true)}
            className="inline-flex items-center justify-center rounded-full bg-[var(--bg-base)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] shadow-sm transition h-9 w-9 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            aria-label="Project overview menu"
          >
            <HiOutlineDotsHorizontal className="h-5 w-5 text-[var(--text-primary)]" />
          </button>
        </div>
      </section>

      {/* Overview Modal */}
      <OverviewModal
        open={showOverviewModal}
        onClose={() => setShowOverviewModal(false)}
        project={project}
      />

      {/* Instagram Export Modal */}
      {canExportToInstagram && (
        <InstagramExportModal
          isOpen={showInstagramModal}
          onClose={() => setShowInstagramModal(false)}
          projectId={project.id}
          projectTitle={project.title}
          images={images}
          expandedBlocks={expandedBlocks}
        />
      )}
    </>
  );
}
