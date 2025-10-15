'use client';

import { useState } from 'react';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import OverviewModal from './OverviewModal';

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
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectHeroProps {
  project: Project;
}

export default function ProjectHero({ project }: ProjectHeroProps) {
  const [showOverviewModal, setShowOverviewModal] = useState(false);

  return (
    <>
      <section className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-b from-neutral-900 to-neutral-800 text-white h-56 md:h-64">
        {/* Subtle overlay gradient */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.15),transparent_60%)]" />
        
        {/* Content */}
        <div className="absolute left-6 bottom-6 right-20">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight mb-2">
            {project.title}
          </h1>
          <p className="mt-1 text-sm/relaxed text-neutral-200">
            {project.category || 'Uncategorized'}
          </p>
        </div>

        {/* Kebab Menu (top-right) */}
        <div className="absolute right-3 top-3">
          <button
            onClick={() => setShowOverviewModal(true)}
            className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition h-9 w-9 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Project overview menu"
          >
            <HiOutlineDotsHorizontal className="h-5 w-5 text-white" />
          </button>
        </div>
      </section>

      {/* Overview Modal */}
      <OverviewModal
        open={showOverviewModal}
        onClose={() => setShowOverviewModal(false)}
        project={project}
      />
    </>
  );
}
