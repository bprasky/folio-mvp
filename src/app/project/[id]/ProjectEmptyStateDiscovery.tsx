'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HiOutlineDotsHorizontal } from 'react-icons/hi';
import { FaSearch, FaArrowLeft, FaCompass, FaUserTie } from 'react-icons/fa';
import OverviewModal from './OverviewModal';

interface Project {
  id: string;
  title: string;
  category?: string | null;
  status?: string | null;
  stage: string;
  projectType: string;
  clientType: string;
  budgetBand: string;
  city?: string | null;
  regionState?: string | null;
  description?: string | null;
  isPublic: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectEmptyStateDiscoveryProps {
  project: Project;
}

// Trending searches - can be replaced with dynamic data later
const TRENDING_SEARCHES = [
  'modern living room',
  'kitchen renovation',
  'bathroom tile',
  'coastal bedroom',
  'lighting ideas',
];

export default function ProjectEmptyStateDiscovery({ project }: ProjectEmptyStateDiscoveryProps) {
  const router = useRouter();
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }, [router]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  const handleChipClick = useCallback((term: string) => {
    handleSearch(term);
  }, [handleSearch]);

  // Format status for display
  const formatStatus = (status: string | null | undefined) => {
    if (!status) return 'Draft';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ');
  };

  return (
    <>
      <div className="min-h-screen bg-surface-canvas">
        {/* Back Navigation */}
        <div className="p-4 bg-surface-ground border-b border-folio-border-subtle">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/projects"
              className="inline-flex items-center text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors folio-ui"
            >
              <FaArrowLeft className="mr-2 w-3 h-3" /> Back to Projects
            </Link>
          </div>
        </div>

        {/* Collapsed Header - Single Line */}
        <header className="border-b border-folio-border-subtle bg-surface-canvas">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Project Name - Serif Italic */}
              <h1 className="font-serif italic text-2xl text-folio-text-primary tracking-tight">
                {project.title}
              </h1>

              {/* Metadata Inline */}
              <div className="flex items-center gap-3 text-folio-text-tertiary">
                <span className="folio-meta">
                  {project.category || 'Uncategorized'}
                </span>
                <span className="text-[var(--ridge-outer)]">|</span>
                <span className="folio-meta">
                  {formatStatus(project.status)}
                </span>
              </div>
            </div>

            {/* Overview Menu Button */}
            <button
              onClick={() => setShowOverviewModal(true)}
              className="inline-flex items-center justify-center rounded-full bg-surface-canvas hover:bg-surface-ground border border-folio-border-subtle shadow-sm transition h-9 w-9 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              aria-label="Project overview menu"
            >
              <HiOutlineDotsHorizontal className="h-5 w-5 text-folio-text-primary" />
            </button>
          </div>
        </header>

        {/* Main Content - Optical center positioning */}
        <main className="max-w-2xl mx-auto px-6 pt-16 pb-24">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div
              className={`
                relative flex items-center w-full h-12 rounded-xl
                bg-surface-ground border transition-all duration-200
                ${isSearchFocused
                  ? 'border-[var(--accent)] shadow-md'
                  : 'border-folio-border-subtle hover:border-folio-text-tertiary'
                }
              `}
            >
              <FaSearch className="absolute left-4 w-4 h-4 text-folio-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Search for ideas, products, or designers"
                className="w-full h-full pl-11 pr-4 bg-transparent text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none folio-body"
              />
            </div>
          </form>

          {/* Or start exploring */}
          <p className="mt-6 text-center folio-meta text-folio-text-tertiary">
            Or start exploring
          </p>

          {/* Trending Search Chips */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {TRENDING_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => handleChipClick(term)}
                className="px-4 py-2 rounded-full bg-surface-ground border border-folio-border-subtle text-folio-text-secondary hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors folio-meta"
              >
                {term}
              </button>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Primary CTA - Explore Magazine */}
            <Link
              href="/magazine"
              className="accent-btn px-6 py-3 flex items-center gap-2"
            >
              <FaCompass className="w-4 h-4" />
              Explore Magazine
            </Link>

            {/* Secondary CTA - Find a Designer */}
            <Link
              href="/designers"
              className="ridge-btn px-6 py-3 flex items-center gap-2"
            >
              <FaUserTie className="w-4 h-4" />
              Find a Designer
            </Link>
          </div>
        </main>
      </div>

      {/* Overview Modal */}
      <OverviewModal
        open={showOverviewModal}
        onClose={() => setShowOverviewModal(false)}
        project={project}
      />
    </>
  );
}
