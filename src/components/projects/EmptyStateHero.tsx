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
 */
export function EmptyStateHero({ userType, userName }: EmptyStateHeroProps) {
  const isDesigner = userType === 'FREE_DESIGNER' || userType === 'PAID_DESIGNER';
  const isIndividual = userType === 'INDIVIDUAL';

  const greeting = userName ? `Welcome, ${userName.split(' ')[0]}` : 'Welcome to Folio';

  return (
    <section className="warm-glass-hero p-8 md:p-12">
      <div className="max-w-2xl mx-auto text-center">
        {/* Icon cluster */}
        <div className="flex justify-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-white/60 border border-white/40 shadow-sm">
            {isDesigner ? (
              <FolderPlus className="h-6 w-6 text-[#5C5C57]" />
            ) : (
              <BookOpen className="h-6 w-6 text-[#5C5C57]" />
            )}
          </div>
          <div className="p-3 rounded-2xl bg-white/60 border border-white/40 shadow-sm">
            <Layers className="h-6 w-6 text-[#5C5C57]" />
          </div>
          {isDesigner && (
            <div className="p-3 rounded-2xl bg-white/60 border border-white/40 shadow-sm">
              <Sparkles className="h-6 w-6 text-[#5C5C57]" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h2 className="text-2xl md:text-3xl font-semibold text-[#1a1a1a] mb-3">
          {greeting}
        </h2>

        {/* Subheading - different per user type */}
        <p className="text-[#666] text-base md:text-lg mb-8 max-w-md mx-auto">
          {isDesigner ? (
            <>Your portfolio starts here. Upload your work, tag the products, and share with the design community.</>
          ) : (
            <>Discover inspiring interiors and save your favorites. Collect ideas for your next project.</>
          )}
        </p>

        {/* Primary CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isDesigner ? (
            <>
              <Link
                href="/designer/create"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full",
                  "bg-[#1a1a1a] text-white font-medium",
                  "hover:bg-[#333] transition-colors",
                  "shadow-md hover:shadow-lg"
                )}
              >
                <FolderPlus className="h-5 w-5" />
                Add Your First Project
              </Link>
              <Link
                href="/magazine"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full",
                  "bg-white/70 text-[#1a1a1a] font-medium",
                  "border border-[#e0e0e0]",
                  "hover:bg-white/90 transition-colors"
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
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full",
                  "bg-[#1a1a1a] text-white font-medium",
                  "hover:bg-[#333] transition-colors",
                  "shadow-md hover:shadow-lg"
                )}
              >
                <BookOpen className="h-5 w-5" />
                Browse the Magazine
              </Link>
              <Link
                href="/boards/new"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full",
                  "bg-white/70 text-[#1a1a1a] font-medium",
                  "border border-[#e0e0e0]",
                  "hover:bg-white/90 transition-colors"
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
