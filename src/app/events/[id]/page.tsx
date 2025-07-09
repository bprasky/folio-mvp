'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Star, 
  Pin, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  MinusCircle,
  Eye,
  Camera,
  BarChart3
} from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location: string;
  city?: string;
  state?: string;
  banner?: string;
  type: string;
  status: string;
  isSignature: boolean;
  isPinned: boolean;
  capacity?: number;
  rsvpCount: number;
  organizer?: {
    id: string;
    name: string;
    profileImage?: string;
  };
  subEvents?: Array<{
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location: string;
    type: string;
    status: string;
    rsvpCount: number;
    speakerName?: string;
    speakerBio?: string;
    companyName?: string;
    capacity?: number;
    featuredGuest?: string;
    totalScans?: number;
    mediaUploadCount?: number;
    totalViews?: number;
    media?: Array<{
      id: string;
      url: string;
      type: string;
    }>;
  }>;
}

export default function EventDetailPage() {
  const params = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRSVP, setUserRSVP] = useState<string | null>(null);
  const [currentUserId] = useState('user-1');

  useEffect(() => {
    if (params?.id) {
      fetchEvent();
    }
  }, [params?.id]);

  const fetchEvent = async () => {
    if (!params?.id) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${params.id}`);
      const data = await response.json();
      
      if (data.success) {
        setEvent(data.event);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (status: string) => {
    if (!params?.id) return;
    
    try {
      const response = await fetch(`/api/events/${params.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, status }),
      });

      if (response.ok) {
        setUserRSVP(status);
        fetchEvent();
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-folio-accent text-white';
      case 'upcoming': return 'bg-folio-accent text-white';
      case 'past': return 'bg-folio-muted text-folio-text';
      default: return 'bg-folio-muted text-folio-text';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Event not found</h3>
          <Link href="/events" className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-folio-background">
      {/* Header */}
      <div className="bg-white border-b border-folio-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                      <div className="flex items-center">
              <Link href="/events" className="mr-4 p-2 text-folio-border hover:text-folio-text rounded-full hover:bg-folio-muted transition-all">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-serif font-bold text-folio-text tracking-tight">{event.title}</h1>
                <div className="flex items-center mt-2 space-x-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                  {event.isSignature && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-folio-accent text-white">
                      <Star className="h-3 w-3 mr-1" />
                      Signature Event
                    </span>
                  )}
                  {event.isPinned && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-folio-accent text-white">
                      <Pin className="h-3 w-3 mr-1" />
                      Pinned
                    </span>
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Event Banner */}
            {event.banner && (
              <div className="relative h-80 rounded-2xl overflow-hidden mb-8 shadow-xl">
                <img src={event.banner} alt={event.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
            )}

            {/* Event Details */}
            <div className="bg-white rounded-2xl border border-folio-border shadow-lg p-8 mb-8">
              <h2 className="text-2xl font-serif font-bold text-folio-text tracking-tight mb-6">About This Event</h2>
              {event.description && (
                <p className="text-folio-text mb-8 leading-relaxed text-lg">{event.description}</p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="space-y-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-folio-muted rounded-xl mr-4">
                        <Calendar className="h-6 w-6 text-folio-text" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-folio-text uppercase tracking-wide">Date & Time</p>
                        <p className="text-folio-text">
                          {formatDate(event.startDate)} - {formatDate(event.endDate)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="p-3 bg-folio-muted rounded-xl mr-4">
                        <MapPin className="h-6 w-6 text-folio-text" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-folio-text uppercase tracking-wide">Location</p>
                        <p className="text-folio-text">{event.location}</p>
                        <p className="text-folio-text">
                          {[event.city, event.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-folio-muted rounded-xl mr-4">
                        <Users className="h-6 w-6 text-folio-text" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-folio-text uppercase tracking-wide">Attendees</p>
                        <p className="text-folio-text">
                          {event.rsvpCount} attending
                          {event.capacity && ` / ${event.capacity} capacity`}
                        </p>
                      </div>
                    </div>
                  </div>
              </div>
            </div>

            {/* Sub-Events Section */}
            {event.subEvents && event.subEvents.length > 0 && (
              <div className="bg-white rounded-2xl border border-folio-border shadow-lg p-8">
                <h2 className="text-2xl font-serif font-bold text-folio-text tracking-tight mb-8">Sub-Events</h2>
                <div className="space-y-6">
                  {event.subEvents.map((subEvent) => (
                    <Link
                      key={subEvent.id}
                      href={`/subevents/${subEvent.id}`}
                      className="block bg-white rounded-2xl border border-folio-border p-6 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-serif font-bold text-folio-text tracking-tight group-hover:text-folio-accent transition-colors">{subEvent.title}</h3>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-folio-accent text-white">
                              {subEvent.type}
                            </span>
                          </div>
                          
                          {/* Featured Guest Callout */}
                          {subEvent.featuredGuest && (
                            <p className="italic text-folio-text mb-4">
                              Featuring special guest: <strong>{subEvent.featuredGuest}</strong>
                            </p>
                          )}
                          
                          {subEvent.description && (
                            <p className="text-folio-text text-sm mb-4 leading-relaxed">{subEvent.description}</p>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-folio-border mr-2" />
                              <span className="text-folio-text">
                                {formatDate(subEvent.startTime)} at {formatTime(subEvent.startTime)}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 text-folio-border mr-2" />
                              <span className="text-folio-text">{subEvent.location}</span>
                            </div>
                            {subEvent.speakerName && (
                              <div className="flex items-center">
                                <Users className="h-4 w-4 text-folio-border mr-2" />
                                <span className="text-folio-text">
                                  {subEvent.speakerName}
                                  {subEvent.companyName && ` (${subEvent.companyName})`}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center">
                              <Users className="h-4 w-4 text-folio-border mr-2" />
                              <span className="text-folio-text">
                                {subEvent.rsvpCount || 0} attending
                                {subEvent.capacity && ` / ${subEvent.capacity} capacity`}
                              </span>
                            </div>
                          </div>
                          
                          {/* Visibility Metrics */}
                          <div className="flex items-center text-xs text-folio-border space-x-4 mb-4">
                            <span className="flex items-center">
                              <BarChart3 className="h-3 w-3 mr-1" />
                              {subEvent.totalScans || 0} scans
                            </span>
                            <span className="flex items-center">
                              <Camera className="h-3 w-3 mr-1" />
                              {subEvent.mediaUploadCount || 0} uploads
                            </span>
                            <span className="flex items-center">
                              <Eye className="h-3 w-3 mr-1" />
                              {subEvent.totalViews || 0} views
                            </span>
                          </div>
                          
                          {/* Media Preview Strip */}
                          {subEvent.media && subEvent.media.length > 0 && (
                            <div className="flex gap-2 mt-4">
                              {subEvent.media.slice(0, 3).map((media) => (
                                <img
                                  key={media.id}
                                  src={media.url}
                                  alt="Event media"
                                  className="w-16 h-16 object-cover rounded-lg border border-folio-border"
                                />
                              ))}
                            </div>
                          )}
                          
                          {/* View Details Link */}
                          <div className="mt-4 pt-4 border-t border-folio-border">
                            <span className="text-folio-accent text-sm font-medium group-hover:underline">
                              View Details →
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subEvent.status)}`}>
                            {subEvent.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP Card */}
            <div className="bg-white rounded-2xl border border-folio-border shadow-lg p-6">
              <h3 className="text-xl font-serif font-bold text-folio-text tracking-tight mb-6">RSVP</h3>
              
              {userRSVP ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-folio-accent text-white">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    You're {userRSVP}
                  </div>
                  <button
                    onClick={() => setUserRSVP(null)}
                    className="w-full px-4 py-3 border border-folio-border rounded-xl text-sm font-medium text-folio-text hover:bg-folio-muted transition-all duration-200"
                  >
                    Remove RSVP
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => handleRSVP('going')}
                    className="w-full px-4 py-3 bg-folio-accent text-white rounded-xl text-sm font-medium hover:bg-opacity-90 hover:scale-105 transition-all duration-200 flex items-center justify-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    I'm Going
                  </button>
                  <button
                    onClick={() => handleRSVP('maybe')}
                    className="w-full px-4 py-3 bg-folio-accent text-white rounded-xl text-sm font-medium hover:bg-opacity-90 hover:scale-105 transition-all duration-200 flex items-center justify-center"
                  >
                    <MinusCircle className="h-4 w-4 mr-2" />
                    Maybe
                  </button>
                  <button
                    onClick={() => handleRSVP('not-going')}
                    className="w-full px-4 py-3 bg-folio-accent text-white rounded-xl text-sm font-medium hover:bg-opacity-90 hover:scale-105 transition-all duration-200 flex items-center justify-center"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Not Going
                  </button>
                </div>
              )}
            </div>

            {/* Organizer */}
            {event.organizer && (
              <div className="bg-white rounded-2xl border border-folio-border shadow-lg p-6">
                <h3 className="text-xl font-serif font-bold text-folio-text tracking-tight mb-6">Organizer</h3>
                <div className="flex items-center">
                  {event.organizer.profileImage ? (
                    <img
                      src={event.organizer.profileImage}
                      alt={event.organizer.name}
                      className="h-14 w-14 rounded-xl mr-4 border-2 border-folio-border"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-folio-muted mr-4 flex items-center justify-center border-2 border-folio-border">
                      <span className="text-lg font-semibold text-folio-text">
                        {event.organizer.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-folio-text">{event.organizer.name}</p>
                    <p className="text-sm text-folio-border">Event Organizer</p>
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