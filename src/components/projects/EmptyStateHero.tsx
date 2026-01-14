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
 * Uses liquid glass elevated styling for premium look.
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
    <section className="liquid-glass-elevated p-8 md:p-12 relative z-10">
      <div className="max-w-2xl mx-auto text-center relative z-10">
        {/* Icon cluster with liquid glass styling */}
        <div className="flex justify-center gap-3 mb-6">
          <div className="p-3 liquid-icon">
            {isDesigner ? (
              <FolderPlus className="h-6 w-6 text-[#5C5C57]" />
            ) : (
              <BookOpen className="h-6 w-6 text-[#5C5C57]" />
            )}
          </div>
          <div className="p-3 liquid-icon">
            <Layers className="h-6 w-6 text-[#5C5C57]" />
          </div>
          {isDesigner && (
            <div className="p-3 liquid-icon">
              <Sparkles className="h-6 w-6 text-[#5C5C57]" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h2 className="text-2xl md:text-3xl font-semibold text-[#1a1a1a] mb-3">
          {headline}
        </h2>

        {/* Subheading - different per user type */}
        <p className="text-[#555] text-base md:text-lg mb-8 max-w-lg mx-auto leading-relaxed">
          {subtext}
        </p>

        {/* Primary CTA with liquid glass buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isDesigner ? (
            <>
              <Link
                href="/designer/create"
                className={cn(
                  "liquid-btn-dark inline-flex items-center gap-2 px-7 py-3.5 font-medium",
                  "text-white/95"
                )}
              >
                <FolderPlus className="h-5 w-5" />
                Add Your First Project
              </Link>
              <Link
                href="/magazine"
                className={cn(
                  "liquid-btn inline-flex items-center gap-2 px-7 py-3.5 font-medium",
                  "text-[#1a1a1a]"
                )}
              >
                <BookOpen className="h-5 w-5" />
                Explore the Magazine
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/magazine"
                className={cn(
                  "liquid-btn-dark inline-flex items-center gap-2 px-7 py-3.5 font-medium",
                  "text-white/95"
                )}
              >
                <BookOpen className="h-5 w-5" />
                Browse the Magazine
              </Link>
              <Link
                href="/boards/new"
                className={cn(
                  "liquid-btn inline-flex items-center gap-2 px-7 py-3.5 font-medium",
                  "text-[#1a1a1a]"
                )}
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
