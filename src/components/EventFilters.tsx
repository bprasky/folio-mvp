'use client';

import { useState } from 'react';
import { FaFilter, FaSort, FaCalendarAlt, FaMapMarkerAlt, FaThLarge, FaClock, FaStar, FaChevronDown, FaChevronUp } from 'react-icons/fa';

export type SortOption = 'default' | 'trending' | 'chronological' | 'recently-listed' | 'by-category';
export type EventTypeFilter = 'all' | 'booth' | 'panel' | 'dinner' | 'demo' | 'workshop' | 'networking' | 'exhibition';

interface EventFiltersProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  eventTypeFilter: EventTypeFilter;
  onEventTypeChange: (type: EventTypeFilter) => void;
  festivalFilter: string | null;
  onFestivalChange: (festivalId: string | null) => void;
  festivals: Array<{ id: string; title: string }>;
  className?: string;
}

export default function EventFilters({
  sortBy,
  onSortChange,
  eventTypeFilter,
  onEventTypeChange,
  festivalFilter,
  onFestivalChange,
  festivals,
  className = ''
}: EventFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const eventTypes = [
    { value: 'all', label: 'All Events' },
    { value: 'booth', label: 'Booth' },
    { value: 'panel', label: 'Panel' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'demo', label: 'Demo' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'networking', label: 'Networking' },
    { value: 'exhibition', label: 'Exhibition' }
  ];

  const sortOptions = [
    { value: 'default', label: 'Default (Fibonacci)', icon: FaThLarge },
    { value: 'trending', label: 'Trending', icon: FaStar },
    { value: 'chronological', label: 'Chronological', icon: FaCalendarAlt },
    { value: 'recently-listed', label: 'Recently Listed', icon: FaClock },
    { value: 'by-category', label: 'By Category', icon: FaSort }
  ];

  const getCurrentSortLabel = () => {
    const option = sortOptions.find(opt => opt.value === sortBy);
    return option?.label || 'Default';
  };

  const getCurrentEventTypeLabel = () => {
    const option = eventTypes.find(opt => opt.value === eventTypeFilter);
    return option?.label || 'All Events';
  };

  const getCurrentFestivalLabel = () => {
    if (!festivalFilter) return 'All Festivals';
    const festival = festivals.find(f => f.id === festivalFilter);
    return festival?.title || 'All Festivals';
  };

  return (
    <div className={`bg-white border-b border-gray-100 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4">
          {/* Search Bar Placeholder - can be expanded later */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search events..."
                className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-folio-accent/20 focus:border-folio-accent/30 bg-gray-50"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Sort & Filter Button */}
          <div className="relative">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-folio-accent/20"
            >
              <FaFilter className="mr-2 h-4 w-4" />
              Sort & Filter
              {isExpanded ? (
                <FaChevronUp className="ml-2 h-3 w-3" />
              ) : (
                <FaChevronDown className="ml-2 h-3 w-3" />
              )}
            </button>

            {/* Dropdown Panel */}
            {isExpanded && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <div className="p-4 space-y-4">
                  {/* Festival Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Festival
                    </label>
                    <select
                      value={festivalFilter || ''}
                      onChange={(e) => onFestivalChange(e.target.value || null)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent/20 focus:border-folio-accent/30"
                    >
                      <option value="">All Festivals</option>
                      {festivals.map((festival) => (
                        <option key={festival.id} value={festival.id}>
                          {festival.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Event Type Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Event Type
                    </label>
                    <select
                      value={eventTypeFilter}
                      onChange={(e) => onEventTypeChange(e.target.value as EventTypeFilter)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent/20 focus:border-folio-accent/30"
                    >
                      {eventTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort Options */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => onSortChange(e.target.value as SortOption)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-folio-accent/20 focus:border-folio-accent/30"
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Active Filters Summary */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Festival: {getCurrentFestivalLabel()}</div>
                      <div>Type: {getCurrentEventTypeLabel()}</div>
                      <div>Sort: {getCurrentSortLabel()}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 