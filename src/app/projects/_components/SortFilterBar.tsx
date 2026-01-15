'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently Updated' },
  { value: 'created', label: 'Recently Created' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'status', label: 'Status' },
  { value: 'phase', label: 'Phase View' },
];

export default function SortFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'updated';

  const handleSortChange = (sortValue: string) => {
    const params = new URLSearchParams(searchParams);
    if (sortValue === 'updated') {
      params.delete('sort');
    } else {
      params.set('sort', sortValue);
    }
    router.push(`/projects?${params.toString()}`);
  };

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <label className="folio-ui font-medium text-[var(--text-primary)]">Sort by:</label>
        <select
          value={currentSort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 folio-ui text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
