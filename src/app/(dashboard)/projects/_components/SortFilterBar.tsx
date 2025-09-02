'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { getAvailableSortOptions } from '../_lib/sort';

export default function SortFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'phase';

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams);
    if (newSort === 'phase') {
      params.delete('sort'); // Default sort, no need for URL param
    } else {
      params.set('sort', newSort);
    }
    router.push(`/projects?${params.toString()}`);
  };

  const availableOptions = getAvailableSortOptions();

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-neutral-700">Sort by:</span>
          
          <select
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="text-sm border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-neutral-500">
          {currentSort === 'phase' ? 'Phase Board View' : `Sorted by ${availableOptions.find(opt => opt.key === currentSort)?.label}`}
        </div>
      </div>
    </div>
  );
}

