'use client';

import Link from 'next/link';
import SafeImage from '@/components/SafeImage';

interface CollaborationCardProps {
  collaboration: {
    id: string;
    title: string;
    type: string;
    description?: string | null;
    imageUrl?: string | null;
    partnerName?: string | null;
    partnerLogo?: string | null;
    projectId?: string | null;
    publishedAt?: string | Date | null;
  };
}

export default function CollaborationCard({ collaboration }: CollaborationCardProps) {
  const href = collaboration.projectId ? `/project/${collaboration.projectId}` : '#';
  const hasLink = !!collaboration.projectId;

  const content = (
    <article className="group overflow-hidden rounded-xl transition-all duration-300 hover:shadow-lg bg-surface-canvas">
      {/* Image section */}
      {collaboration.imageUrl && (
        <div className="relative aspect-[16/9] overflow-hidden bg-folio-border-subtle">
          <SafeImage
            src={collaboration.imageUrl}
            alt={collaboration.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Partner logo overlay */}
          {collaboration.partnerLogo && (
            <div className="absolute bottom-3 right-3">
              <div
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-lg"
                style={{ backgroundColor: 'white' }}
              >
                <SafeImage
                  src={collaboration.partnerLogo}
                  alt={collaboration.partnerName || 'Partner'}
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={`p-5 ${collaboration.imageUrl ? 'border-t border-folio-border-subtle' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span
            className="px-2 py-1 text-xs rounded-full"
            style={{ backgroundColor: '#EDE9FE', color: '#6D28D9' }}
          >
            <span className="mr-1">&#129309;</span>
            {formatCollabType(collaboration.type)}
          </span>
        </div>

        {/* Title */}
        <h3
          className="font-medium leading-tight line-clamp-2 mb-2 text-folio-text-primary"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {collaboration.title}
        </h3>

        {/* Partner info */}
        <div className="flex items-center gap-3 mb-3">
          {!collaboration.imageUrl && collaboration.partnerLogo && (
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-surface-elevated"
            >
              <SafeImage
                src={collaboration.partnerLogo}
                alt={collaboration.partnerName || 'Partner'}
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          {collaboration.partnerName && (
            <span className="text-sm text-folio-text-secondary">
              with <span className="font-medium">{collaboration.partnerName}</span>
            </span>
          )}
        </div>

        {/* Description */}
        {collaboration.description && (
          <p className="text-sm line-clamp-3 text-folio-text-secondary">
            {collaboration.description}
          </p>
        )}

        {/* View project link */}
        {hasLink && (
          <div className="mt-4 flex items-center gap-1 text-xs text-folio-text-secondary">
            <span>View project</span>
            <ArrowRightIcon />
          </div>
        )}
      </div>
    </article>
  );

  if (hasLink) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

function formatCollabType(type: string): string {
  const typeMap: Record<string, string> = {
    FORMAL_PARTNERSHIP: 'Partnership',
    PROJECT: 'Joint Project',
    PRODUCT_FEATURE: 'Product Feature',
    JOINT_VENTURE: 'Joint Venture',
  };
  return typeMap[type] || 'Collaboration';
}

function ArrowRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  );
}
