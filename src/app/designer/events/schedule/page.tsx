'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaArrowLeft } from 'react-icons/fa';

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  type: string;
  createdBy: {
    name: string;
    companyName: string | null;
  };
}

export default function DesignerEventsSchedule() {
  const [rsvpEvents, setRsvpEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, we'll show a placeholder since RSVP functionality isn't implemented yet
    // In the future, this would fetch events the designer has RSVPed to
    setLoading(false);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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

  const getEventTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'booth': return '🏪';
      case 'dinner': return '🍽️';
      case 'panel': return '🎤';
      case 'party': return '🎉';
      case 'workshop': return '🛠️';
      case 'exhibition': return '🎨';
      case 'networking': return '🤝';
      default: return '📅';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        
        <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="p-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-folio-accent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
        <div className="p-4 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              href="/events"
              className="flex items-center text-folio-text-muted hover:text-folio-accent transition-colors mb-4"
            >
              <FaArrowLeft className="mr-2" />
              Back to Events
            </Link>
            <h1 className="text-3xl font-bold text-folio-text mb-2">My Event Schedule</h1>
            <p className="text-folio-text-muted">
              Events you've RSVPed to and your upcoming design activities
            </p>
          </div>

          {/* Placeholder Content */}
          <div className="bg-white rounded-lg shadow-sm border border-folio-border p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-folio-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FaCalendarAlt className="w-8 h-8 text-folio-accent" />
              </div>
              <h2 className="text-2xl font-bold text-folio-text mb-4">RSVP Feature Coming Soon</h2>
              <p className="text-folio-text-muted mb-6 max-w-md mx-auto">
                We're working on implementing RSVP functionality so you can easily track and manage 
                your event attendance. For now, you can browse all events and bookmark your favorites.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/events"
                  className="px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
                >
                  Browse All Events
                </Link>
                <Link
                  href="/designer"
                  className="px-6 py-3 bg-gray-100 text-folio-text rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Designer Dashboard
                </Link>
              </div>
            </div>
          </div>

          {/* Future Implementation Note */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">What's Coming Next</h3>
            <ul className="text-blue-800 space-y-1">
              <li>• RSVP to events directly from the events page</li>
              <li>• Calendar integration for your scheduled events</li>
              <li>• Event notifications and reminders</li>
              <li>• Connect with other designers attending the same events</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 