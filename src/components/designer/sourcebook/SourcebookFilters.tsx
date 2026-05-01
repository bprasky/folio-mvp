'use client';

import { Search } from 'lucide-react';
import FilterPill from './FilterPill';
import type { SourcebookSortField, SourcebookFilters as Filters } from '@/types/sourcebook';

interface SourcebookFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  sortField: SourcebookSortField;
  onSortChange: (field: SourcebookSortField) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  uniqueVendors: string[];
  uniqueCategories: string[];
  uniqueProjects: Array<{ projectId: string; projectTitle: string }>;
}

const SORT_OPTIONS: { value: SourcebookSortField; label: string }[] = [
  { value: 'lastUsedAt', label: 'Recently Used' },
  { value: 'projectCount', label: 'Most Used' },
  { value: 'productBrand', label: 'Vendor A\u2013Z' },
  { value: 'productName', label: 'Product A\u2013Z' },
  { value: 'tagCount', label: 'Tag Count' },
];

export default function SourcebookFilters({
  searchTerm,
  onSearchChange,
  filters,
  onFilterChange,
  sortField,
  onSortChange,
  showArchived,
  onShowArchivedChange,
  uniqueVendors,
  uniqueCategories,
  uniqueProjects,
}: SourcebookFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      {/* Search */}
      <div className="relative flex-1 min-w-[160px] max-w-[280px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-neutral-200 bg-white h-8 focus:border-[var(--folio-gold-ornament)] focus:ring-0 focus:outline-none transition-colors"
        />
      </div>

      {/* Filter pills */}
      <FilterPill
        label="Vendor"
        options={uniqueVendors.map(v => ({ value: v, label: v }))}
        value={filters.vendor || ''}
        onChange={(v) => onFilterChange('vendor', v)}
        searchable
      />
      <FilterPill
        label="Category"
        options={uniqueCategories.map(c => ({ value: c, label: c }))}
        value={filters.category || ''}
        onChange={(v) => onFilterChange('category', v)}
      />
      <FilterPill
        label="Project"
        options={uniqueProjects.map(p => ({ value: p.projectId, label: p.projectTitle }))}
        value={filters.project || ''}
        onChange={(v) => onFilterChange('project', v)}
        searchable
      />
      <FilterPill
        label="Sort"
        options={SORT_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
        value={sortField}
        onChange={(v) => onSortChange(v as SourcebookSortField)}
      />

      {/* Archive toggle */}
      <label className="ml-auto flex items-center gap-1.5 text-[12px] text-neutral-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => onShowArchivedChange(e.target.checked)}
          className="rounded accent-[var(--folio-gold-ornament)]"
        />
        Show archived
      </label>
    </div>
  );
}
