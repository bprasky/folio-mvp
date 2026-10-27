'use client';

import Image from '@/components/FolioImage';
import Link from 'next/link';
import type { DirectoryVendor } from '@/lib/directory/types';

interface VendorCardProps {
  vendor: DirectoryVendor;
}

export default function VendorCard({ vendor }: VendorCardProps) {
  return (
    <Link href={`/vendor/${vendor.organization.id}`} className="block group">
      <div className="glass-surface rounded-xl overflow-hidden transition-all hover:shadow-lg">
        {/* Logo area */}
        <div className="relative aspect-[3/2] bg-surface-ground overflow-hidden flex items-center justify-center">
          {vendor.organization.logo ? (
            <Image
              src={vendor.organization.logo}
              alt={vendor.organization.name}
              fill
              className="object-contain p-6"
            />
          ) : (
            <span className="text-4xl font-semibold text-folio-text-tertiary">
              {vendor.organization.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-base font-semibold text-folio-text-primary truncate group-hover:text-[var(--accent)] transition-colors">
            {vendor.organization.name}
          </h3>
          <p className="text-sm text-[var(--accent)] mt-0.5 capitalize">
            {vendor.organization.type.replace(/_/g, ' ').toLowerCase()}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-folio-text-tertiary">
            <span>{vendor.stats.designersTagging} designers</span>
            <span>{vendor.stats.projectsIncluded} projects</span>
            <span>{vendor.stats.catalogSize} products</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
