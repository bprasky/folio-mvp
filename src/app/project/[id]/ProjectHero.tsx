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
      <section className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 h-56 md:h-64 border border-gray-200/50">
        {/* Content */}
        <div className="absolute left-6 bottom-6 right-20">
          <h1 className="text-4xl md:text-5xl font-serif italic tracking-tight mb-2 text-gray-900">
            {project.title}
          </h1>
          <p className="mt-1 text-sm/relaxed text-gray-600">
            {project.category || 'Uncategorized'}
          </p>
        </div>

        {/* Action Buttons (top-right) */}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {/* Share to Instagram Button */}
          {canExportToInstagram && (
            <button
              onClick={() => setShowInstagramModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-md hover:bg-white/90 border border-gray-200/50 shadow-sm transition text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              aria-label="Share to Instagram"
            >
              <FaInstagram className="w-4 h-4" />
              <span className="hidden sm:inline">Share to Instagram</span>
            </button>
          )}

          {/* Kebab Menu */}
          <button
            onClick={() => setShowOverviewModal(true)}
            className="inline-flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md hover:bg-white/90 border border-gray-200/50 shadow-sm transition h-9 w-9 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Project overview menu"
          >
            <HiOutlineDotsHorizontal className="h-5 w-5 text-gray-700" />
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
