'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Event } from '../lib/fetchEvents';
import EventCard from './EventCard';
import EventTile from './EventTile';
import EventFilters, { SortOption, EventTypeFilter } from './EventFilters';
import { getBuzzBadges, getEventTypeIcon } from '../lib/fetchEvents';
import { 
  arrangeEventsForFibonacci, 
  getFibonacciGridClasses,
  FibonacciTile 
} from '../lib/fibonacciUtils';
import { FaFilter, FaChevronDown, FaChevronUp } from 'react-icons/fa';

interface EventFeedProps {
  events: Event[];
  festivals: Array<{ id: string; title: string }>;
  userRole: string;
  userRSVPs: any[];
  className?: string;
}

// Calculate event weight based on importance factors
const calculateEventWeight = (event: Event): number => {
  let weight = 0;
  
  // +40 if event is sponsored
  if (event.isSponsored) {
    weight += 40;
  }
  
  // +30 if part of a festival (festivalId present)
  if (event.parentFestival) {
    weight += 30;
  }
  
  // +25 if boostLevel is priority
  if (event.boostLevel === 'priority') {
    weight += 25;
  }
  // +15 if boostLevel is boosted
  else if (event.boostLevel === 'boosted') {
    weight += 15;
  }
  
  // +20 if rising in popularity (rsvp_change_24h > 10)
  if (event.rsvp_change_24h && event.rsvp_change_24h > 10) {
    weight += 20;
  }
  
  // +30 if inviteCount >= 500
  if (event.rsvps && event.rsvps.length >= 500) {
    weight += 30;
  }
  // +20 if inviteCount >= 200
  else if (event.rsvps && event.rsvps.length >= 200) {
    weight += 20;
  }
  // +15 if inviteCount >= 50
  else if (event.rsvps && event.rsvps.length >= 50) {
    weight += 15;
  }
  // +10 otherwise
  else {
    weight += 10;
  }
  
  // +10 if recently created (within last 7 days)
  const daysSinceCreated = (Date.now() - new Date(event.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated <= 7) {
    weight += 10;
  }
  
  return weight;
};

// Get buzz badge for events
const getBuzzBadge = (event: Event): string | null => {
  if (event.isSponsored) return '✨ Editor\'s Pick';
  if (event.boostLevel === 'priority') return '⭐ Priority';
  if (event.rsvp_change_24h && event.rsvp_change_24h > 10) return '📈 Rising';
  if (event.rsvps && event.rsvps.length > 50) return '🔥 Popular';
  if (event.rsvps && event.rsvps.length > 20) return '👥 Trending';
  if (event.parentFestival) return '🎭 Festival Event';
  return null;
};

// Get span class based on event weight - soft hierarchy
const getSpanClass = (weight: number): string => {
  if (weight >= 80) return 'col-span-2 row-span-2';
  if (weight >= 60) return 'col-span-2 row-span-1';
  if (weight >= 50) return 'col-span-1 row-span-2';
  return 'col-span-1 row-span-1';
};

export default function EventFeed({ 
  events, 
  festivals, 
  userRole, 
  userRSVPs, 
  className = '' 
}: EventFeedProps) {
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('all');
  const [festivalFilter, setFestivalFilter] = useState<string | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>(events);
  const [fibonacciTiles, setFibonacciTiles] = useState<FibonacciTile[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [feedLoaded, setFeedLoaded] = useState(false);

  // Apply filters and sorting
  useEffect(() => {
    setLoading(true);
    
    let filtered = events.filter(event => {
      // Festival filter
      const matchesFestival = festivalFilter 
        ? event.parentFestival?.id === festivalFilter 
        : true;
      
      // Event type filter
      const matchesType = eventTypeFilter === 'all' 
        ? true 
        : event.eventTypes?.some(type => type.toLowerCase() === eventTypeFilter);
      
      return matchesFestival && matchesType;
    });

    // Apply sorting
    switch (sortBy) {
      case 'default':
        // For Fibonacci layout, arrange with priority-based ordering
        const tiles = arrangeEventsForFibonacci(filtered);
        setFibonacciTiles(tiles);
        setFilteredEvents(filtered);
        break;
      case 'chronological':
        filtered.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setFilteredEvents(filtered);
        setFibonacciTiles([]);
        break;
      case 'trending':
        filtered.sort((a, b) => {
          const aBadges = getBuzzBadges(a);
          const bBadges = getBuzzBadges(b);
          const aTrending = aBadges.some(badge => badge.label.includes('Trending') || badge.label.includes('Popular'));
          const bTrending = bBadges.some(badge => badge.label.includes('Trending') || badge.label.includes('Popular'));
          if (aTrending && !bTrending) return -1;
          if (!aTrending && bTrending) return 1;
          return (b.rsvps?.length || 0) - (a.rsvps?.length || 0);
        });
        setFilteredEvents(filtered);
        setFibonacciTiles([]);
        break;
      case 'recently-listed':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setFilteredEvents(filtered);
        setFibonacciTiles([]);
        break;
      case 'by-category':
        filtered.sort((a, b) => (a.eventTypes?.[0] || '').localeCompare(b.eventTypes?.[0] || ''));
        setFilteredEvents(filtered);
        setFibonacciTiles([]);
        break;
    }

    setLoading(false);
    
    // Track analytics after first successful load
    if (!feedLoaded && filteredEvents.length > 0) {
      setFeedLoaded(true);
      if (typeof window !== 'undefined' && (window as any)?.analytics) {
        (window as any).analytics.track('event_feed_loaded', {
          eventCount: filteredEvents.length,
          sortBy,
          filters: { eventTypeFilter, festivalFilter }
        });
      }
    }
  }, [events, sortBy, eventTypeFilter, festivalFilter, feedLoaded]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Enhanced Fibonacci skeleton loader
  const FibonacciSkeleton = () => (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto min-h-[80vh]">
      {[...Array(12)].map((_, i) => {
        // Simulate weight-based span pattern for skeleton
        const getSpanFromIndex = (index: number) => {
          if (index < 2) return 'col-span-2 row-span-2';
          if (index < 4) return 'col-span-2 row-span-1';
          if (index < 6) return 'col-span-1 row-span-2';
          return 'col-span-1 row-span-1';
        };
        
        const spanClass = getSpanFromIndex(i);
        
        return (
          <div key={i} className={`bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse overflow-hidden ${spanClass}`}>
            <div className="w-full h-48 bg-gray-200"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );

  // Render Fibonacci layout with dynamic sizing
  const renderFibonacciLayout = () => (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto min-h-[80vh]">
        {filteredEvents.map((event, index) => {
          const buzzBadge = getBuzzBadge(event);
          
          // Use weight-based span class
          const spanClass = getSpanClass(calculateEventWeight(event));
        
          return (
            <motion.div
              key={event.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden transition-transform transform hover:scale-[1.01] duration-300 ease-in-out ${spanClass}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              {/* Buzz Badge */}
              {buzzBadge && (
                <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                  {buzzBadge}
                </div>
              )}
              
              {/* Visual Debug Aid */}
              <span className="absolute top-1 right-1 bg-black text-white text-xs px-1 rounded z-10">
                {calculateEventWeight(event)}
              </span>
              
              <EventCard
                event={event}
                getEventTypeIcon={getEventTypeIcon}
                getBuzzBadges={getBuzzBadges}
                formatDate={formatDate}
                formatTime={formatTime}
                userRSVPs={userRSVPs}
                userRole={userRole}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // Render standard grid layout (for non-Fibonacci views)
  const renderStandardLayout = () => (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {filteredEvents.map((event, index) => (
        <motion.div
          key={event.id}
          className="bg-white rounded-xl shadow-lg overflow-hidden col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-1 transition-transform transform hover:scale-[1.01] duration-300 ease-in-out"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <EventCard
            event={event}
            getEventTypeIcon={getEventTypeIcon}
            getBuzzBadges={getBuzzBadges}
            formatDate={formatDate}
            formatTime={formatTime}
            userRSVPs={userRSVPs}
            userRole={userRole}
          />
        </motion.div>
      ))}
      </div>
    </div>
  );

  // Determine which layout to use
  const useFibonacciLayout = sortBy === 'default' || sortBy === 'trending';

  // Get current filter summary for display
  const getFilterSummary = () => {
    const parts = [];
    if (eventTypeFilter !== 'all') parts.push(eventTypeFilter);
    if (festivalFilter) {
      const festival = festivals.find(f => f.id === festivalFilter);
      if (festival) parts.push(festival.title);
    }
    if (sortBy !== 'default') {
      const sortLabels = {
        'chronological': 'Chronological',
        'recently-listed': 'Recently Listed',
        'by-category': 'Alphabetical',
        'trending': 'Trending'
      };
      parts.push(sortLabels[sortBy] || sortBy);
    }
    return parts.length > 0 ? parts.join(', ') : 'All events';
  };

  return (
    <div className={`w-full overflow-x-hidden ${className}`}>
      {/* Sticky Sort & Filter Menu Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="w-full max-w-7xl mx-auto py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-900">Events</h2>
              <span className="text-sm text-gray-500">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Sort Options */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent/20"
              >
                <option value="default">Most Buzz</option>
                <option value="trending">Trending</option>
                <option value="chronological">Chronological</option>
                <option value="recently-listed">Recently Listed</option>
                <option value="by-category">Alphabetical</option>
              </select>
              
              {/* Filter Toggle */}
              <button
                onClick={() => setFiltersVisible(!filtersVisible)}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                <FaFilter className="w-4 h-4" />
                <span>Filters</span>
                {filtersVisible ? <FaChevronUp className="w-4 h-4" /> : <FaChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          {/* Filter Summary */}
          <div className="mt-2">
            <span className="text-sm text-gray-600">
              Showing: <span className="font-medium">{getFilterSummary()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Filters Panel */}
      {filtersVisible && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="w-full max-w-7xl mx-auto py-4">
            <EventFilters
              sortBy={sortBy}
              onSortChange={setSortBy}
              eventTypeFilter={eventTypeFilter}
              onEventTypeChange={setEventTypeFilter}
              festivalFilter={festivalFilter}
              onFestivalChange={setFestivalFilter}
              festivals={festivals}
            />
          </div>
        </div>
      )}

      {/* Events Grid */}
      <div className="w-full py-8">
        {loading ? (
          useFibonacciLayout ? <FibonacciSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto px-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse overflow-hidden">
                  <div className="w-full h-48 bg-gray-200"></div>
                  <div className="p-6 space-y-3">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                      <div className="w-20 h-6 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredEvents.length === 0 ? (
          <div className="w-full flex items-center justify-center py-16">
            <div className="max-w-md mx-auto text-center">
              <div className="text-6xl mb-6">🎭</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {eventTypeFilter !== 'all' || festivalFilter ? 'No events match your filters' : 'No events yet'}
              </h3>
              <p className="text-gray-600 mb-8">
                {eventTypeFilter !== 'all' || festivalFilter 
                  ? 'Try widening your search filters or check back soon!'
                  : 'We\'re working hard to bring you amazing design events. Check back soon!'
                }
              </p>
              
              <div className="space-y-4">
                {userRole === 'admin' && (
                  <a
                    href="/events/create"
                    className="inline-flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
                  >
                    Create an Event
                  </a>
                )}
                {userRole === 'guest' && (
                  <a
                    href="/auth/signin"
                    className="inline-flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
                  >
                    Sign In to Get Notified
                  </a>
                )}
                <p className="text-sm text-gray-500">
                  Join our community to be the first to know about new events.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {filteredEvents.length === 0 && (
              <div className="text-gray-500 col-span-full text-center mt-8">
                No events match your filters.
              </div>
            )}
            {filteredEvents.length > 0 && (
              useFibonacciLayout ? renderFibonacciLayout() : renderStandardLayout()
            )}
          </>
        )}
      </div>
    </div>
  );
} 