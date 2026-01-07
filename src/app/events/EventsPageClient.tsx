'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaFilter, FaPlus, FaEye, FaUser, FaHeart, FaEdit } from 'react-icons/fa';
import { MdEvent, MdDashboard, MdSchedule } from 'react-icons/md';
import { arrangeEventsForFibonacci, getFibonacciGridClasses, FibonacciTile } from '../../lib/fibonacciUtils';
import { Event } from '../../lib/fetchEvents';

interface Festival {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  eventTypes: string[];
  createdBy: {
    id: string;
    name: string;
    companyName: string | null;
  };
  subevents: {
    id: string;
  }[];
  createdAt: string; // Added for buzz badge logic
}



interface EventsPageClientProps {
  festivals: Festival[];
  events: Event[];
  userRole: string;
  userRSVPs: any[];
  userId?: string;
}

const EventsPageClient: React.FC<EventsPageClientProps> = ({
  festivals,
  events,
  userRole,
  userRSVPs,
  userId,
}) => {
  // Update state to track expanded festival instead of selected for filtering
  // We'll use expandedFestival for dropdown, and separate state if needed for filtering
  // But for now, when expanded, show list in accordion below carousel
  const [expandedFestival, setExpandedFestival] = useState<string | null>(null);
  // Update eventTypeFilter type
  type EventTypeFilter = 'all' | 'booth' | 'product launch' | 'happy hour' | 'lunch & learn' | 'design panel' | 'demonstration';
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeFilter>('all');
  // Update tagFilter state to match spec types
  type BuzzTag = 'all' | 'trending' | 'new' | 'rising' | 'has stories';
  const [tagFilter, setTagFilter] = useState<BuzzTag>('all');

  // Update filteredEvents to include festival filter
  const filteredEvents = events.filter(event => {
    const matchesFestival = expandedFestival ? event.parentFestival?.id === expandedFestival : !event.parentFestival;
    // Get the primary event type from the eventTypes array
    const primaryEventType = event.eventTypes && event.eventTypes.length > 0 ? event.eventTypes[0].toLowerCase() : 'other';
    const matchesType = eventTypeFilter === 'all' || primaryEventType === eventTypeFilter;
    let matchesTag = tagFilter === 'all';
    if (tagFilter !== 'all') {
      const badges = getBuzzBadges(event);
      matchesTag = badges.some(b => b.label.toLowerCase().includes(tagFilter.toLowerCase()));
    }
    return matchesFestival && matchesType && matchesTag;
  });

  // Generate Fibonacci layout for filtered events
  const fibonacciTiles = filteredEvents.length >= 3 ? arrangeEventsForFibonacci(filteredEvents) : [];

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
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

  // Update getEventTypeIcon to support new types
  const getEventTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'booth': return '🏪';
      case 'product launch': return '🚀';
      case 'happy hour': return '🍸';
      case 'lunch & learn': return '🥗';
      case 'design panel': return '🎤';
      case 'demonstration': return '🖥️';
      default: return '📅';
    }
  };

  // Add helper for buzz badges
  const getBuzzBadges = (event: Event) => {
    const badges = [];
    
    // Placeholder for others - would use RSVP data in future
    if (Math.random() > 0.7) badges.push({ label: '📈 Rising', color: 'bg-green-100 text-green-800' });
    if (Math.random() > 0.9) badges.push({ label: '🔥 Trending', color: 'bg-red-100 text-red-800' });
    if (Math.random() > 0.5) badges.push({ label: '🎥 Has Stories', color: 'bg-purple-100 text-purple-800' });
    // Add Editor's Pick to getBuzzBadges
    if (Math.random() > 0.95) badges.push({ label: '⭐ Editor\'s Pick', color: 'bg-yellow-100 text-yellow-800' });
    // Editor's pick would be a field on event

    return badges;
  };

  // Add helper for festival tags
  const getFestivalTags = (festival: Festival) => {
    const tags = [];
    const now = new Date();
    const start = new Date(festival.startDate);
    const end = new Date(festival.endDate);
    const created = new Date(festival.createdAt);
    const ageHours = (now.getTime() - created.getTime()) / (1000 * 3600);

    if (start <= now && end >= now) {
      tags.push({ label: 'LIVE', color: 'bg-green-500 text-white shadow-glow', glow: true });
    }
    if (ageHours < 48) {
      tags.push({ label: 'New', color: 'bg-blue-100 text-blue-800' });
    }
    return tags;
  };

  // Update FestivalCarouselSection to use expandedFestival and show dropdown list when expanded
  // For dropdown, we'll render a list of subevents below the carousel if expanded
  // But to integrate, perhaps render conditionally below carousel if expanded
  // For now, add to the section
  // Actually, since it's horizontal, showing below entire carousel might not associate well; perhaps show inline below each card when clicked
  // To do that, we can render the list inside the card when expanded

  // Modify the map to include conditional list inside card if expanded
  const FestivalCarouselSection = () => {
    if (festivals.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-folio-text mb-4">Featured Festivals</h2>
        <div className="flex overflow-x-auto space-x-4 pb-4">
          {festivals.map((festival) => {
            const tags = getFestivalTags(festival);
            const isExpanded = expandedFestival === festival.id;
            const isLive = tags.some(t => t.label === 'LIVE');
            // Get subevents: filter events with parentFestival.id === festival.id
            const subevents = events.filter(e => e.parentFestival?.id === festival.id).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

            return (
              <div
                key={festival.id}
                className={`flex-shrink-0 w-72 bg-white rounded-lg shadow-sm border cursor-pointer transition-all ${isExpanded ? 'border-folio-accent ring-2 ring-folio-accent ring-opacity-50' : 'border-folio-border hover:shadow-md'} ${isLive ? 'shadow-[0_0_15px_rgba(34,197,94,0.3)]' : ''}`}
                onClick={() => setExpandedFestival(isExpanded ? null : festival.id)}
              >
                {/* Image placeholder */}
                <div className="w-full h-32 bg-gray-100 rounded-t-lg flex items-center justify-center text-4xl">
                  🎪
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag, i) => (
                        <span key={i} className={`px-2 py-1 text-xs font-medium rounded-full ${tag.color} ${tag.glow ? 'shadow-glow' : ''}`}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-folio-text-muted">
                      {festival.subevents.length} events
                    </span>
                  </div>
                  <h3 className="font-semibold text-folio-text mb-2 line-clamp-2">{festival.title}</h3>
                  <p className="text-sm text-folio-text-muted mb-3 line-clamp-3">{festival.description}</p>
                  <div className="space-y-1">
                    <div className="flex items-center text-xs text-folio-text-muted">
                      <FaCalendarAlt className="w-3 h-3 mr-2" />
                      {formatDate(festival.startDate)} - {formatDate(festival.endDate)}
                    </div>
                    <div className="flex items-center text-xs text-folio-text-muted">
                      <FaMapMarkerAlt className="w-3 h-3 mr-2" />
                      {festival.location}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="p-4 border-t">
                    <h4 className="font-semibold mb-2">Events in this Festival</h4>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {subevents.length > 0 ? (
                        subevents.map((sub) => (
                          <li key={sub.id} className="text-sm">
                            <Link href={`/events/${sub.id}`} className="hover:underline">
                              {sub.title} - {formatDate(sub.startDate)}
                            </Link>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-500">No events yet</li>
                      )}
                    </ul>
                    <h4 className="font-semibold mt-4 mb-2">Stories</h4>
                    <div className="flex overflow-x-auto space-x-4 pb-4">
                      <div className="flex-shrink-0 w-64 h-36 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                        No stories yet — be the first!
                      </div>
                      {/* Future: map over actual stories */}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Updated EventCard to support layoutSize prop
  const EventCard = ({ event, layoutSize = 'default' }: { event: Event; layoutSize?: 'XL' | 'L' | 'M' | 'S' | 'default' }) => {
    const badges = getBuzzBadges(event);
    
    // Get layout classes based on size
    const getLayoutClasses = () => {
      switch (layoutSize) {
        case 'XL':
          return 'col-span-2 row-span-2';
        case 'L':
          return 'col-span-2 row-span-1';
        case 'M':
          return 'col-span-1 row-span-1';
        case 'S':
          return 'col-span-1 row-span-1';
        default:
          return 'col-span-1 row-span-1';
      }
    };

    // Get typography classes based on size
    const getTypographyClasses = () => {
      switch (layoutSize) {
        case 'XL':
          return {
            title: 'text-2xl font-bold',
            description: 'text-base',
            meta: 'text-sm'
          };
        case 'L':
          return {
            title: 'text-xl font-bold',
            description: 'text-sm',
            meta: 'text-xs'
          };
        case 'M':
          return {
            title: 'text-lg font-semibold',
            description: 'text-sm',
            meta: 'text-xs'
          };
        case 'S':
        default:
          return {
            title: 'text-base font-semibold',
            description: 'text-xs',
            meta: 'text-xs'
          };
      }
    };

    const typography = getTypographyClasses();
    
    return (
      <Link
        href={`/events/${event.id}`}
        className={`block bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 overflow-hidden ${getLayoutClasses()}`}
      >
        {/* Image Container */}
        <div className={`relative ${layoutSize === 'XL' ? 'h-64' : layoutSize === 'L' ? 'h-48' : layoutSize === 'M' ? 'h-40' : 'h-32'} overflow-hidden`}>
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                            <span className="text-4xl">{getEventTypeIcon(event.eventTypes && event.eventTypes.length > 0 ? event.eventTypes[0] : 'OTHER')}</span>
          </div>
          
          {/* Admin Edit Icon */}
          {userRole === 'ADMIN' && (
            <Link href={`/admin/events/${event.id}`} onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-sm hover:bg-blue-600 transition-colors z-20">
                <FaEdit className="w-3 h-3" />
              </div>
            </Link>
          )}
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {badges.slice(0, layoutSize === 'S' ? 1 : 2).map((badge, index) => (
              <span
                key={index}
                className={`px-2 py-1 text-xs font-medium rounded-full shadow-sm ${badge.color} backdrop-blur-sm bg-opacity-90`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className={`${typography.title} text-gray-900 line-clamp-2 leading-tight`}>
            {event.title}
          </h3>

          {/* Description - only show for larger tiles */}
          {(layoutSize === 'XL' || layoutSize === 'L') && event.description && (
            <p className={`${typography.description} text-gray-600 line-clamp-2`}>
              {event.description}
            </p>
          )}

          {/* Event Details */}
          <div className="space-y-2">
            {/* Date and Time */}
            <div className="flex items-center text-gray-500">
              <FaCalendarAlt className={`${typography.meta} mr-2 flex-shrink-0`} />
              <span className={`${typography.meta}`}>
                {formatDate(event.startDate)}
                {event.startDate !== event.endDate && ` - ${formatDate(event.endDate)}`}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center text-gray-500">
              <FaMapMarkerAlt className={`${typography.meta} mr-2 flex-shrink-0`} />
              <span className={`${typography.meta} line-clamp-1`}>
                {event.location}
              </span>
            </div>

            {/* RSVP Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center text-gray-500">
                <FaUser className={`${typography.meta} mr-2 flex-shrink-0`} />
                <span className={`${typography.meta}`}>
                  {Math.floor(Math.random() * 100)} RSVPs
                </span>
              </div>
              
              {/* Event Type Icon */}
              <div className="flex items-center text-gray-400">
                <span className={`${typography.meta} mr-1`}>
                  {getEventTypeIcon(event.eventTypes && event.eventTypes.length > 0 ? event.eventTypes[0] : 'OTHER')}
                </span>
                <span className={`${typography.meta} capitalize`}>
                  {event.eventTypes && event.eventTypes.length > 0 ? event.eventTypes[0] : 'OTHER'}
                </span>
              </div>
            </div>
          </div>

          {/* Festival Badge - only show for larger tiles */}
          {(layoutSize === 'XL' || layoutSize === 'L') && event.parentFestival && (
            <div className="pt-2 border-t border-gray-100">
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-folio-accent bg-folio-accent/10 rounded-full">
                {event.parentFestival.title}
              </span>
            </div>
          )}
        </div>
      </Link>
    );
  };

  // Update RoleActions to match permissions
  const RoleActions = () => {
    switch (userRole) {
      case 'admin':
        return (
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/events/approvals" className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Manage Events
            </Link>
            <Link href="/admin/festivals/create" className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Create Festival
            </Link>
            <Link href="/events/create" className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Create Event
            </Link>
            <Link href="/admin/events" className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Edit Events
            </Link>
            <Link href="/events" className="flex items-center px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
              View Events
            </Link>
          </div>
        );
      case 'vendor':
        return (
          <div className="flex gap-3">
            <Link href="/vendors/events/create" className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <FaPlus className="mr-2" />
              Create Event
            </Link>
            <Link href="/vendor/events" className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              My Events
            </Link>
          </div>
        );
      case 'designer':
        return (
          <div className="flex gap-3">
            <Link href="/designer/events/schedule" className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <MdSchedule className="mr-2" />
              My Schedule
            </Link>
          </div>
        );
      case 'homeowner':
        return null;
      default:
        return null;
    }
  };

  // Add selectedFest and update header
  const selectedFest = festivals.find(f => f.id === expandedFestival);

  return (
    <div className="p-4 lg:p-8">

      {/* Header with Role Actions - now top of page */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-folio-text mb-2">{selectedFest ? `Events in ${selectedFest.title}` : 'Upcoming Events'}</h2>
          <p className="text-folio-text-muted">{selectedFest ? 'Explore events within this festival' : 'Discover all design events'}</p>
        </div>
        
        <div className="mt-4 lg:mt-0">
          <RoleActions />
        </div>
      </div>

      {/* Add back the admin action bar before the header */}
      {/* --- ADMIN ACTION BAR: Always visible for debugging --- */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/festivals/create"
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Create Festival
        </Link>
        <Link
          href="/events/create"
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Create Event
        </Link>
      </div>

      {/* Festival Carousel */}
      <FestivalCarouselSection />

      {/* Filters - updated options */}
      <div className="flex flex-wrap gap-4 mb-6 sticky top-0 bg-gray-50 z-10 py-4">
        <div className="flex items-center space-x-2">
          <FaFilter className="text-folio-text-muted" />
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value as EventTypeFilter)}
            className="px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
          >
            <option value="all">All Types</option>
            <option value="booth">Booth</option>
            <option value="product launch">Product Launch</option>
            <option value="happy hour">Happy Hour</option>
            <option value="lunch & learn">Lunch & Learn</option>
            <option value="design panel">Design Panel</option>
            <option value="demonstration">Demonstration</option>
          </select>
        </div>
        
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value as BuzzTag)}
          className="px-3 py-2 border border-folio-border rounded-lg focus:outline-none focus:ring-2 focus:ring-folio-accent"
        >
          <option value="all">All Buzz</option>
          <option value="trending">Trending</option>
          <option value="new">New</option>
          <option value="rising">Rising</option>
          <option value="has stories">Has Stories</option>
        </select>

        {/* Remove clear festival button from filters */}
      </div>

      {/* Events Feed - Updated to use Fibonacci layout */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">🎭</div>
            <h3 className="text-2xl font-bold text-folio-text mb-4">
              { (eventTypeFilter !== 'all' || tagFilter !== 'all') ? 'No events match your filters' : 'No events yet'}
            </h3>
            <p className="text-folio-text-muted mb-8">
              { (eventTypeFilter !== 'all' || tagFilter !== 'all') 
                ? 'Try adjusting your filters or check back later for new events. We\'re constantly adding exciting design events!'
                : 'We\'re working hard to bring you amazing design events. Check back soon for workshops, exhibitions, and networking opportunities!'
              }
            </p>
            
            {/* Call to Action based on role */}
            {userRole === 'ADMIN' && (
              <div className="space-y-4">
                <Link
                  href="/events/create"
                  className="inline-flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
                >
                  <FaPlus className="mr-2" />
                  Create Your First Event
                </Link>
                <p className="text-sm text-folio-text-muted">
                  As an admin, you can create festivals and events to get the community engaged.
                </p>
              </div>
            )}
            
            {userRole === 'VENDOR' && (
              <div className="space-y-4">
                <Link
                  href="/events/create"
                  className="inline-flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
                >
                  <FaPlus className="mr-2" />
                  Create an Event
                </Link>
                <p className="text-sm text-folio-text-muted">
                  Host workshops, product launches, or networking events to connect with designers.
                </p>
              </div>
            )}
            
            {userRole === 'DESIGNER' && (
              <div className="space-y-4">
                <Link
                  href="/inspire"
                  className="inline-flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
                >
                  <FaUser className="mr-2" />
                  Explore Design Inspiration
                </Link>
                <p className="text-sm text-folio-text-muted">
                  While you wait for events, discover amazing design projects from the community.
                </p>
              </div>
            )}
            
            {userRole === 'guest' && (
              <div className="space-y-4">
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
                >
                  <FaUser className="mr-2" />
                  Sign In to Get Notified
                </Link>
                <p className="text-sm text-folio-text-muted">
                  Join our community to be the first to know about new events and opportunities.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Use Fibonacci layout for 3+ events, fallback to single column for fewer
        filteredEvents.length >= 3 ? (
          <div className={getFibonacciGridClasses()}>
            {fibonacciTiles.map((tile) => (
              <EventCard 
                key={tile.event.id} 
                event={tile.event} 
                layoutSize={tile.size}
              />
            ))}
          </div>
        ) : (
          // Single column layout for fewer than 3 events
          <div className="grid grid-cols-1 gap-6 max-w-2xl mx-auto">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} layoutSize="default" />
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default EventsPageClient; 