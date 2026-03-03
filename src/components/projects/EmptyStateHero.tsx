'use client';

import { FolderPlus, BookOpen, Layers, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { UserType } from '@/hooks/useUserCapabilities';

interface EmptyStateHeroProps {
  userType: UserType;
  userName?: string;
}

/**
 * EmptyStateHero - Main empty state for the projects page
 *
 * Displays different CTAs based on user type:
 * - Designers: "Add Your First Project" with "Explore the Magazine" secondary
 * - Individuals: "Browse the Magazine" with "Create a Collection" secondary
 *
 * Uses Folio neumorphic ridge-card styling.
 */
export function EmptyStateHero({ userType, userName }: EmptyStateHeroProps) {
  const isDesigner = userType === 'FREE_DESIGNER' || userType === 'PAID_DESIGNER';
  const isIndividual = userType === 'INDIVIDUAL';

  // Use the spec-defined headlines
  const headline = isDesigner ? 'Your Studio Starts Here' : 'Your Design Boards';
  const subtext = isDesigner
    ? 'Add past projects to build your portfolio. Tag products, tell your story through our AI interview, and share your work with the design community.'
    : 'Save products and inspiration from the Magazine into organized collections. Keep track of ideas for your space in one place.';

  return (
    <section className="p-8 md:p-12 relative z-10">
      <div className="max-w-2xl mx-auto text-center relative z-10">
        {/* Icon cluster with ridge styling */}
        <div className="flex justify-center gap-3 mb-6">
          <div className="p-3 ridge-card ridge-card-sm">
            {isDesigner ? (
              <FolderPlus className="h-6 w-6 text-[var(--text-secondary)]" />
            ) : (
              <BookOpen className="h-6 w-6 text-[var(--text-secondary)]" />
            )}
          </div>
          <div className="p-3 ridge-card ridge-card-sm">
            <Layers className="h-6 w-6 text-[var(--text-secondary)]" />
          </div>
          {isDesigner && (
            <div className="p-3 ridge-card ridge-card-sm">
              <Sparkles className="h-6 w-6 text-[var(--accent)]" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h2 className="folio-h1 text-[var(--text-primary)] mb-3">
          {headline}
        </h2>

        {/* Subheading - different per user type */}
        <p className="folio-body text-[var(--text-secondary)] mb-8 max-w-lg mx-auto leading-relaxed">
          {subtext}
        </p>

        {/* Primary CTA with ridge buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isDesigner ? (
            <>
              <Link
                href="/designer/create"
                className="accent-btn inline-flex items-center gap-2 px-7 py-3.5"
              >
                <FolderPlus className="h-5 w-5" />
                Add Your First Project
              </Link>
              <Link
                href="/magazine"
                className="ridge-btn inline-flex items-center gap-2 px-7 py-3.5"
              >
                <BookOpen className="h-5 w-5" />
                Explore the Magazine
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/magazine"
                className="accent-btn inline-flex items-center gap-2 px-7 py-3.5"
              >
                <BookOpen className="h-5 w-5" />
                Browse the Magazine
              </Link>
              <Link
                href="/boards/new"
                className="ridge-btn inline-flex items-center gap-2 px-7 py-3.5"
              >
                <Layers className="h-5 w-5" />
                Create a Collection
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default EmptyStateHero;
