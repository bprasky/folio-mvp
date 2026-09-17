'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'projects', label: 'Projects' },
  { id: 'media', label: 'Media' },
  { id: 'recognition', label: 'Recognition' },
  { id: 'collaborations', label: 'Collaborations' },
];

const SORTS = [
  { id: 'featured', label: 'Featured First' },
  { id: 'recent', label: 'Recent' },
  { id: 'engagement', label: 'Most Saved' },
];

interface FeedFiltersProps {
  activeFilter: string;
  activeSort: string;
  orgId: string;
  isAdmin?: boolean;
  onAddRecognition?: () => void;
}

export default function FeedFilters({ activeFilter, activeSort, orgId, isAdmin, onAddRecognition }: FeedFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if ((key === 'filter' && value === 'all') || (key === 'sort' && value === 'featured')) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6" aria-label="Filter organization feed">
      {FILTERS.map(filter => (
        <div key={filter.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateParams('filter', filter.id)}
            aria-pressed={activeFilter === filter.id}
            className="px-4 py-1.5 text-xs rounded-full transition-all"
            style={{
              backgroundColor: activeFilter === filter.id ? '#2C2825' : 'transparent',
              color: activeFilter === filter.id ? 'var(--surface-ground)' : '#6B635B',
              border: activeFilter === filter.id ? 'none' : '1px solid #D4CEC6',
            }}
          >
            {filter.label}
          </button>
          {filter.id === 'recognition' && isAdmin && onAddRecognition && (
            <button
              type="button"
              onClick={onAddRecognition}
              className="w-6 h-6 text-xs rounded-full flex items-center justify-center transition-all hover:opacity-80"
              style={{ border: '1px solid #D4CEC6', color: '#6B635B' }}
              aria-label="Add recognition"
            >
              +
            </button>
          )}
        </div>
      ))}

      <div className="flex-1" />

      <select
        aria-label="Sort organization feed"
        value={activeSort}
        onChange={e => updateParams('sort', e.target.value)}
        className="text-xs px-3 py-1.5 rounded-full border appearance-none cursor-pointer"
        style={{
          borderColor: '#D4CEC6',
          color: '#6B635B',
          backgroundColor: 'transparent',
        }}
      >
        {SORTS.map(sort => (
          <option key={sort.id} value={sort.id}>
            {sort.label}
          </option>
        ))}
      </select>
    </div>
  );
}
