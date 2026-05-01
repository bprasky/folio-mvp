'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export interface Facet {
  value: string;
  label: string;
  count: number;
}

interface FilterChipsProps {
  facets: {
    styles: Facet[];
    materials: Facet[];
    colors: Facet[];
    vendors: Facet[];
    categories: Facet[];
    mood?: Facet[];
    elements?: Facet[];
  };
  activeFilters: Record<string, string>;
  onFilterChange: (filterType: string, value: string | null) => void;
  isLoading?: boolean;
}

/**
 * Editorial filter chips - subtle, magazine-like curation
 * No section headers, flowing line, counts on hover only
 */
export default function FilterChips({
  facets,
  activeFilters,
  onFilterChange,
  isLoading = false,
}: FilterChipsProps) {
  // Combine all facets into single flat array
  const allFacets: Array<Facet & { filterType: string }> = [
    ...facets.materials.map(f => ({ ...f, filterType: 'material' })),
    ...facets.colors.map(f => ({ ...f, filterType: 'color' })),
    ...facets.categories.map(f => ({ ...f, filterType: 'category' })),
    ...facets.styles.map(f => ({ ...f, filterType: 'style' })),
    ...facets.vendors.map(f => ({ ...f, filterType: 'vendor' })),
    ...(facets.mood || []).map(f => ({ ...f, filterType: 'mood' })),
    ...(facets.elements || []).map(f => ({ ...f, filterType: 'element' })),
  ];

  // Sort by count descending, then alphabetically
  allFacets.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });

  // Get active filter chips
  const activeFilterChips: Array<{ filterType: string; value: string; label: string }> = [];
  Object.entries(activeFilters).forEach(([filterType, value]) => {
    // Find the label from facets
    const facet = allFacets.find(f => f.filterType === filterType && f.value === value);
    activeFilterChips.push({
      filterType,
      value,
      label: facet?.label || formatLabel(value),
    });
  });

  // Remove active filters from available facets
  const availableFacets = allFacets.filter(
    facet => !activeFilterChips.some(
      active => active.filterType === facet.filterType && active.value === facet.value
    )
  );

  // Check if there's anything to show
  if (isLoading) {
    return (
      <div className="px-8 pb-4">
        <div className="flex items-center gap-2 text-[#9A9A9A] text-sm">
          <span className="inline-block w-16 h-4 bg-[#E0E0E0] animate-pulse rounded" />
          <span className="text-[#D0D0D0]">·</span>
          <span className="inline-block w-20 h-4 bg-[#E0E0E0] animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const hasContent = activeFilterChips.length > 0 || availableFacets.length > 0;
  if (!hasContent) return null;

  return (
    <div className="px-8 pb-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {/* Active filters first - styled as pills */}
        {activeFilterChips.map((active) => (
          <button
            key={`active-${active.filterType}-${active.value}`}
            onClick={() => onFilterChange(active.filterType, null)}
            className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-ground hover:bg-surface-ground text-folio-text-primary hover:text-folio-text-primary transition-all font-sans text-xs backdrop-blur-sm border border-folio-border-subtle hover:border-folio-border-subtle"
            title={`Remove ${active.label} filter`}
          >
            <span>{active.label}</span>
            <X className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-folio-text-tertiary" />
          </button>
        ))}

        {/* Available facets - styled as pills */}
        {availableFacets.map((facet) => (
          <button
            key={`${facet.filterType}-${facet.value}`}
            onClick={() => onFilterChange(facet.filterType, facet.value)}
            className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-canvas hover:bg-surface-ground text-folio-text-secondary hover:text-folio-text-primary transition-all font-sans text-xs backdrop-blur-sm border border-folio-border-subtle hover:border-folio-border-subtle"
            title={`${facet.label} (${facet.count})`}
          >
            <span>{facet.label}</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-folio-text-tertiary text-[var(--type-fine)]">
              {facet.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Format label for display - capitalize first letter of each word
 */
function formatLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
