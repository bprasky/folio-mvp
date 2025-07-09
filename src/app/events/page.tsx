'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Clock, Users, Star, Pin, Search, Filter } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  thumbnail?: string;
  banner?: string;
  type: string;
  status: string;
  isSignature: boolean;
  isPinned: boolean;
  capacity?: number;
  rsvpCount: number;
  subEventCount: number;
  mediaCount: number;
  productCount: number;
  organizer?: {
    id: string;
    name: string;
    profileImage?: string;
  };
}



export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events?filter=${filter}`);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };



  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'past': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'signature': return 'bg-folio-accent text-white';
      case 'design-week': return 'bg-folio-accent text-white';
      case 'festival': return 'bg-folio-accent text-white';
      case 'trade-show': return 'bg-folio-accent text-white';
      default: return 'bg-folio-muted text-folio-text';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-folio-background">
      {/* Header */}
      <div className="bg-white border-b border-folio-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-folio-text">Events</h1>
              <p className="mt-2 text-folio-border">
                Discover and attend the latest design events, trade shows, and industry gatherings
              </p>
            </div>
            <div className="mt-4 lg:mt-0">
              <Link
                href="/admin/events/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-folio-accent hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-folio-accent transition-colors"
              >
                Create Event
              </Link>
            </div>
          </div>
        </div>
      </div>



      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-folio-border h-4 w-4" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-folio-border rounded-md focus:ring-folio-accent focus:border-folio-accent bg-folio-muted"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-folio-border rounded-md text-sm font-medium text-folio-text bg-white hover:bg-folio-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-folio-accent transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-folio-border">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All Events' },
                  { key: 'upcoming', label: 'Upcoming' },
                  { key: 'active', label: 'Active Now' },
                  { key: 'past', label: 'Past Events' },
                  { key: 'signature', label: 'Signature Events' }
                ].map((filterOption) => (
                  <button
                    key={filterOption.key}
                    onClick={() => setFilter(filterOption.key)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filter === filterOption.key
                        ? 'bg-folio-accent text-white'
                        : 'bg-folio-muted text-folio-text hover:bg-folio-card'
                    }`}
                  >
                    {filterOption.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-folio-border" />
            <h3 className="mt-2 text-sm font-medium text-folio-text">No events found</h3>
            <p className="mt-1 text-sm text-folio-border">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new event.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-folio-border"
              >
                {/* Event Image */}
                <div className="relative h-48 bg-folio-muted">
                  {event.banner ? (
                    <img
                      src={event.banner}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="h-12 w-12 text-folio-border" />
                    </div>
                  )}
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    {event.isPinned && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-folio-accent text-white">
                        <Pin className="h-3 w-3 mr-1" />
                        Pinned
                      </span>
                    )}
                    {event.isSignature && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-folio-accent text-white">
                        <Star className="h-3 w-3 mr-1" />
                        Signature
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEventStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                  </div>
                </div>

                {/* Event Content */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-folio-text group-hover:text-folio-accent transition-colors">
                      {event.title}
                    </h3>
                  </div>

                  {event.description && (
                    <p className="text-sm text-folio-border mb-4 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* Event Details */}
                  <div className="space-y-2 text-sm text-folio-border">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>
                        {event.location}
                        {event.city && `, ${event.city}`}
                        {event.state && `, ${event.state}`}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>
                        {formatTime(event.startDate)} - {formatTime(event.endDate)}
                      </span>
                    </div>

                    {event.capacity && (
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        <span>{event.rsvpCount} / {event.capacity} attending</span>
                      </div>
                    )}
                  </div>

                  {/* Event Type */}
                  <div className="mt-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                      {event.type.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Organizer */}
                  {event.organizer && (
                    <div className="mt-4 flex items-center">
                      {event.organizer.profileImage ? (
                        <img
                          src={event.organizer.profileImage}
                          alt={event.organizer.name}
                          className="h-6 w-6 rounded-full mr-2"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-folio-muted mr-2 flex items-center justify-center">
                          <span className="text-xs text-folio-text">
                            {event.organizer.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-folio-border">by {event.organizer.name}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 