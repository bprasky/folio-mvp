"use client";

import React, { useState, useMemo } from 'react';
import EventCard from './EventCard';
import EventTypeFilter from './EventTypeFilter';
import { FaFilter, FaSort, FaTh, FaList } from 'react-icons/fa';

interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  isVirtual: boolean;
  imageUrl?: string;
  promotionTier: number;
  eventTypes: string[];
  includesFood: boolean;
  capacity?: number;
  rsvps?: any[];
  createdBy?: {
    name: string;
    profileImage?: string;
  };
  eventTags?: string[];
  designStyles?: string[];
  isSponsored?: boolean;
  allowChat?: boolean;
}

interface FibonacciEventFeedProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  className?: string;
  userRole?: string;
}

type SortOption = 'date' | 'promotion' | 'popularity' | 'name';

export default function FibonacciEventFeed({ events, onEventClick, className, userRole }: FibonacciEventFeedProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter events by selected types
  const filteredEvents = useMemo(() => {
    if (selectedTypes.length === 0) return events;
    
    return events.filter((event) =>
      event.eventTypes.some((type) => selectedTypes.includes(type))
    );
  }, [events, selectedTypes]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    
    switch (sortBy) {
      case 'date':
        return sorted.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      case 'promotion':
        return sorted.sort((a, b) => b.promotionTier - a.promotionTier);
      case 'popularity':
        return sorted.sort((a, b) => (b.rsvps?.length || 0) - (a.rsvps?.length || 0));
      case 'name':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  }, [filteredEvents, sortBy]);

  // Fibonacci grid layout calculation
  const getGridLayout = () => {
    const fibonacci = [1, 1, 2, 3, 5, 8, 13, 21];
    const layout: { [key: number]: string } = {};
    
    // Assign Fibonacci-based classes to events based on their promotion tier
    sortedEvents.forEach((event, index) => {
      const fibIndex = Math.min(index % fibonacci.length, 7);
      const fibValue = fibonacci[fibIndex];
      
      if (event.promotionTier === 2) {
        // Featured events get full width
        layout[index] = "col-span-4 row-span-2";
      } else if (event.promotionTier === 1) {
        // Boosted events get medium width
        layout[index] = "col-span-2 row-span-2";
      } else {
        // Standard events get Fibonacci-based sizing
        layout[index] = `col-span-${Math.min(fibValue, 3)} row-span-1`;
      }
    });
    
    return layout;
  };

  const gridLayout = getGridLayout();

  const handleEventClick = (event: Event) => {
    if (onEventClick) {
      onEventClick(event);
    }
  };

  return (
    <div className={className}>
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Events ({filteredEvents.length})
          </h2>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              showFilters
                ? "bg-folio-accent text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <FaFilter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          {/* Sort Dropdown */}
          <div className="flex items-center space-x-2">
            <FaSort className="w-4 h-4 text-gray-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-folio-accent focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="promotion">Sort by Promotion</option>
              <option value="popularity">Sort by Popularity</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                "p-2 rounded-md transition-colors",
                viewMode === 'grid'
                  ? "bg-white text-folio-accent shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <FaTh className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-2 rounded-md transition-colors",
                viewMode === 'list'
                  ? "bg-white text-folio-accent shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <FaList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <EventTypeFilter
            selectedTypes={selectedTypes}
            onTypeChange={setSelectedTypes}
          />
        </div>
      )}

      {/* Events Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-4 gap-4 auto-rows-fr">
          {sortedEvents.map((event, index) => (
            <div key={event.id} className={gridLayout[index]}>
              <EventCard
                event={event}
                onClick={() => handleEventClick(event)}
                className="h-full"
                userRole={userRole}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedEvents.map((event) => (
            <div key={event.id} className="col-span-4">
              <EventCard
                event={event}
                onClick={() => handleEventClick(event)}
                className="h-full"
                userRole={userRole}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredEvents.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
          <p className="text-gray-500">
            {selectedTypes.length > 0 
              ? "Try adjusting your filters to see more events."
              : "There are no events available at the moment."
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Helper function for conditional classes
function clsx(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
} 