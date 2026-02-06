'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

interface ProductsFiltersProps {
  vendors: Array<{ id: string; name: string }>;
}

export default function ProductsFilters({ vendors }: ProductsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (!value || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    
    // Reset to page 1 when filtering
    params.set('page', '1');
    
    router.push(`/vendor/products?${params.toString()}`);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value;
      updateFilter('q', value || undefined);
    }
  };

  const toggleDrafts = () => {
    const currentValue = searchParams.get('includeDrafts') !== '0';
    const params = new URLSearchParams(searchParams.toString());
    
    if (currentValue) {
      params.set('includeDrafts', '0'); // Hide drafts
    } else {
      params.delete('includeDrafts'); // Show all (default)
    }
    
    params.set('page', '1');
    router.push(`/vendor/products?${params.toString()}`);
  };

  const includeDrafts = searchParams.get('includeDrafts') !== '0';

  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Vendor Filter */}
        {vendors.length > 1 && (
          <select
            value={searchParams.get('vendorId') || ''}
            onChange={(e) => updateFilter('vendorId', e.target.value || undefined)}
            className="rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 px-3 py-2 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          >
            <option value="">All Suppliers</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="relative md:col-span-2">
          <input
            type="text"
            defaultValue={searchParams.get('q') || ''}
            onKeyDown={handleSearch}
            placeholder="Search by name or brand..."
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 px-3 py-2 pl-10 focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        </div>
      </div>

      {/* Draft Filter Toggle */}
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-stone-700 dark:text-stone-300">
          <input
            type="checkbox"
            checked={includeDrafts}
            onChange={toggleDrafts}
            className="rounded border-stone-300 dark:border-stone-700 text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          Show draft products
        </label>
        {!includeDrafts && (
          <span className="text-xs text-stone-500 dark:text-stone-400">
            (Only showing published products)
          </span>
        )}
      </div>
    </div>
  );
}
