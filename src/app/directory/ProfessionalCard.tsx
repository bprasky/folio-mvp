'use client';

import Image from 'next/image';
import Link from 'next/link';
import BookmarkButton from './BookmarkButton';
import type { DirectoryDesigner } from '@/lib/directory/types';

interface ProfessionalCardProps {
  designer: DirectoryDesigner;
  isAuthenticated: boolean;
  onBookmarkToggle?: (professionalId: string, bookmarked: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  DESIGNER: 'Interior Designer',
  ARCHITECT: 'Architect',
  BUILDER: 'Builder',
};

export default function ProfessionalCard({
  designer,
  isAuthenticated,
  onBookmarkToggle,
}: ProfessionalCardProps) {
  const roleLabel = designer.user.role
    ? ROLE_LABELS[designer.user.role] || designer.user.title || 'Designer'
    : designer.user.title || 'Designer';

  return (
    <Link href={`/profile/${designer.user.id}`} className="block group">
      <div className="glass-surface rounded-xl overflow-hidden transition-all hover:shadow-lg">
        {/* Hero Image (3:2 aspect ratio) */}
        <div className="relative aspect-[3/2] bg-surface-ground overflow-hidden">
          {designer.featuredProject?.heroImage ? (
            <Image
              src={designer.featuredProject.heroImage}
              alt={designer.featuredProject.title || designer.user.name}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          ) : designer.user.profileImage ? (
            <Image
              src={designer.user.profileImage}
              alt={designer.user.name}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl font-semibold text-folio-text-tertiary">
                {designer.user.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Bookmark */}
          {isAuthenticated && (
            <div className="absolute top-2 right-2">
              <BookmarkButton
                professionalId={designer.user.id}
                initialBookmarked={designer.isBookmarked || false}
                onToggle={onBookmarkToggle}
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-base font-semibold text-folio-text-primary truncate group-hover:text-[var(--accent)] transition-colors">
            {designer.user.name}
          </h3>
          <p className="text-sm text-[var(--accent)] mt-0.5">
            {roleLabel}
          </p>
          {designer.user.location && (
            <p className="text-sm text-folio-text-secondary mt-0.5">
              {designer.user.location}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-folio-text-tertiary">
            <span>{designer.stats.projectCount} {designer.stats.projectCount === 1 ? 'project' : 'projects'}</span>
            {designer.stats.totalSaves > 0 && (
              <span>{designer.stats.totalSaves} saves</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
