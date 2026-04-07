'use client';

import { useRouter, useSearchParams } from 'next/navigation';

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
  activeSort?: string;
  userId: string;
}

export default function FeedFilters({
  activeFilter,
  activeSort = 'featured',
  userId,
}: FeedFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/profile/${userId}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(filter => (
          <button
            key={filter.id}
            onClick={() => updateParams('filter', filter.id)}
            className={`px-4 py-1.5 text-xs rounded-full transition-all ${
              activeFilter === filter.id
                ? 'bg-folio-text-primary text-surface-ground border-none'
                : 'bg-transparent text-folio-text-secondary border border-folio-border-strong'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Sort Dropdown */}
      <div className="relative">
        <select
          value={activeSort}
          onChange={e => updateParams('sort', e.target.value)}
          className="text-xs px-4 py-1.5 pr-8 rounded-full border border-folio-border-strong text-folio-text-secondary bg-transparent appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1"
        >
          {SORTS.map(sort => (
            <option key={sort.id} value={sort.id}>
              {sort.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon />
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8B8178"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
