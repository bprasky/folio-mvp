'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FaCalendarAlt, FaMapMarkerAlt, FaUser, FaArrowLeft, FaEdit } from 'react-icons/fa';
import FestivalEditModal from '../../../components/FestivalEditModal';
import FestivalEventsList from '../../../components/FestivalEventsList';
import ActionStrip from "@/components/events/ActionStrip";
import EventFeaturedProducts from "@/components/events/EventFeaturedProducts";
import VendorSpotlight from "@/components/events/VendorSpotlight";
import InsightBar from "@/components/events/InsightBar";

type UIProduct = {
  id: string;
  name: string;
  imageUrl?: string;
  vendorName?: string;
};

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  eventTypes: string[];
  imageUrl?: string;
  createdBy: {
    id: string;
    name: string;
    companyName?: string;
  };
  parentFestival?: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  } | null;
  subevents?: {
    id: string;
    title: string;
    startDate: string;
    eventTypes: string[];
  }[];
}

interface FestivalEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  imageUrl?: string;
  rsvp_count: number;
  createdBy: {
    id: string;
    name: string;
    companyName?: string;
  };
}

interface EventDetailClientProps {
  event: any; // from EVENT_SELECT_FULL (server-fetched)
  canEdit?: boolean;
  featuredProducts?: UIProduct[];
}

export default function EventDetailClient({ event, canEdit = false, featuredProducts = [] }: EventDetailClientProps) {
  const { data: session } = useSession();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [festivalEvents, setFestivalEvents] = useState<FestivalEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(event);

  const userRole = session?.user?.role || 'guest';
  useEffect(() => {
    // Fetch festival events if this is a festival
    if (currentEvent.eventTypes?.includes('FESTIVAL')) {
      fetchFestivalEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent.id]);

  const fetchFestivalEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const response = await fetch(`/api/festivals/${currentEvent.id}/events`);
      if (response.ok) {
        const events = await response.json();
        setFestivalEvents(events);
      }
    } catch (error) {
      console.error('Error fetching festival events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleEditFestival = async (updatedData: any) => {
    try {
      const response = await fetch(`/api/festivals/${currentEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to update festival');
      }

      const updatedFestival = await response.json();
      setCurrentEvent(updatedFestival);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating festival:', error);
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

  const getEventTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'festival':
        return '🎪';
      case 'workshop':
        return '🔧';
      case 'showcase':
        return '🎨';
      case 'networking':
        return '🤝';
      default:
        return '📅';
    }
  };

  return (
    <div className="min-h-screen bg-folio-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Back to festival crumb if applicable */}
          {event.parentFestivalId && (
            <a
              href={`/events/${event.parentFestivalId}`}
              className="inline-flex items-center gap-1 text-sm text-folio-accent hover:underline mb-2"
            >
              ← Back to festival
            </a>
          )}
          
          <Link
            href="/events"
            className="inline-flex items-center text-folio-text-muted hover:text-folio-text transition-colors mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to Events
          </Link>
          
          {/* Event Image */}
          {currentEvent.imageUrl && (
            <div className="relative h-64 md:h-96 rounded-lg overflow-hidden mb-6">
              <img
                src={currentEvent.imageUrl}
                alt={currentEvent.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-20"></div>
            </div>
          )}

          {/* Event Content */}
          <div className="max-w-4xl mx-auto">
            {/* ACTIONS */}
            <div className="mt-4">
              <ActionStrip event={{
                id: currentEvent.id,
                title: currentEvent.title,
                startDate: currentEvent.startDate as any,
                endDate: currentEvent.endDate as any,
                location: currentEvent.location,
                createdBy: currentEvent.createdBy ? {
                  id: currentEvent.createdBy.id,
                  name: currentEvent.createdBy.name,
                  companyName: (currentEvent.createdBy as any).companyName
                } : null,
                parentFestivalId: currentEvent.parentFestivalId || null,
              }} />
            </div>

            {/* FEATURED PRODUCTS */}
            <EventFeaturedProducts
              products={featuredProducts}
              canEdit={canEdit}
              eventId={currentEvent.id}
              onSaveProduct={(productId) => {
                // no-op for now or call your existing "save to project" sheet
                // e.g., openSaveSheet({ productId })
                console.log('Save product to project:', productId);
              }}
            />

            {/* VENDOR SPOTLIGHT */}
            <div className="mt-4">
              <VendorSpotlight vendor={currentEvent.createdBy ? {
                id: currentEvent.createdBy.id,
                name: currentEvent.createdBy.name,
                companyName: (currentEvent.createdBy as any).companyName || null,
                logoUrl: (currentEvent.createdBy as any).logoUrl || null,
              } : null} />
            </div>

            {/* INSIGHTS (ADMIN ONLY) */}
            {canEdit ? (
              <div className="mt-4">
                <InsightBar event={{ id: currentEvent.id, rsvps: (currentEvent as any).rsvps || [] }} />
              </div>
            ) : null}

            <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
              <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-bold text-folio-text">{currentEvent.title}</h1>
                
                {/* Edit Buttons for Admins */}
                {canEdit && (
                  <div className="flex gap-2">
                    {currentEvent.eventTypes?.includes('FESTIVAL') ? (
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                      >
                        <FaEdit className="mr-2" />
                        Edit Festival
                      </button>
                    ) : (
                      <Link
                        href={`/admin/events/new?edit=${currentEvent.id}`}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FaEdit className="mr-2" />
                        Edit Event
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center text-folio-text">
                  <FaCalendarAlt className="w-5 h-5 mr-3 text-folio-accent" />
                  <div>
                    <p className="font-medium">{formatDate(currentEvent.startDate)}</p>
                    <p className="text-sm text-folio-text-muted">
                      {formatTime(currentEvent.startDate)} - {formatTime(currentEvent.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-folio-text">
                  <FaMapMarkerAlt className="w-5 h-5 mr-3 text-folio-accent" />
                  <div>
                    <p className="font-medium">{currentEvent.location}</p>
                    <p className="text-sm text-folio-text-muted">Location</p>
                  </div>
                </div>
                <div className="flex items-center text-folio-text">
                  <FaUser className="w-5 h-5 mr-3 text-folio-accent" />
                  <div>
                    <p className="font-medium">{currentEvent.createdBy.name}</p>
                    <p className="text-sm text-folio-text-muted">
                      {currentEvent.createdBy.companyName || 'Organizer'}
                    </p>
                  </div>
                </div>
              </div>
              {/* RSVP Coming Soon */}
              {userRole === 'designer' && (
                <div className="text-center mb-6">
                  <p className="text-folio-text-muted mb-2">Want to RSVP to this event?</p>
                  <p className="text-sm text-folio-text-muted">
                    RSVP functionality coming soon! For now, bookmark this page.
                  </p>
                </div>
              )}
            </div>
            {/* Event Description */}
            <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
              <h2 className="text-xl font-bold text-folio-text mb-4">About This Event</h2>
              <div className="prose prose-folio max-w-none">
                <p className="text-folio-text leading-relaxed whitespace-pre-wrap">{currentEvent.description}</p>
              </div>
            </div>
            {/* Festival Events Section - Show if this is a festival */}
            {currentEvent.eventTypes?.includes('FESTIVAL') && (
              <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
                {isLoadingEvents ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading festival events...</p>
                  </div>
                ) : (
                  <FestivalEventsList events={festivalEvents} />
                )}
              </div>
            )}
            {/* Parent Festival Link - Show if this event belongs to a festival */}
            {currentEvent.parentFestival && (
              <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
                <h2 className="text-xl font-bold text-folio-text mb-4">Part of Festival</h2>
                <Link
                  href={`/events/${currentEvent.parentFestival.id}`}
                  className="inline-flex items-center p-4 border border-folio-border rounded-lg hover:border-folio-accent hover:shadow-md transition-all"
                >
                  <div>
                    <h3 className="font-semibold text-folio-text">{currentEvent.parentFestival.title}</h3>
                    <p className="text-sm text-folio-text-muted">
                      {new Date(currentEvent.parentFestival.startDate).toLocaleDateString()} - {new Date(currentEvent.parentFestival.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              </div>
            )}
            {/* Back to Events */}
            <div className="text-center">
              <Link
                href="/events"
                className="inline-flex items-center px-6 py-3 bg-gray-100 text-folio-text rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FaArrowLeft className="mr-2" />
                Browse All Events
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Festival Edit Modal */}
      <FestivalEditModal
        festival={currentEvent}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditFestival}
      />
    </div>
  );
}