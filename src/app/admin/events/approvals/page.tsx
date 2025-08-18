'use client';

import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaMapMarkerAlt, FaUser, FaCheck, FaTimes, FaEye } from 'react-icons/fa';

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  type: string;
  isApproved: boolean;
  createdBy: {
    id: string;
    name: string;
    companyName: string;
  };
}

const EventApprovalsPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingEvents();
  }, []);

  const fetchPendingEvents = async () => {
    try {
      const response = await fetch('/api/admin/events/approvals');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching pending events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (eventId: string, approved: boolean) => {
    setActionLoading(eventId);
    try {
      const response = await fetch('/api/admin/events/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId, approved }),
      });

      if (response.ok) {
        // Remove the event from the list
        setEvents(events.filter(event => event.id !== eventId));
      }
    } catch (error) {
      console.error('Error updating event approval:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pl-20 lg:pl-56">
        <div className="p-4 lg:p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pl-20 lg:pl-56">
      <div className="p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-folio-text mb-2">Event Approvals</h1>
          <p className="text-folio-text-muted">Review and approve pending events</p>
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-folio-border p-8 text-center">
            <FaCalendarAlt className="mx-auto text-4xl text-folio-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-folio-text mb-2">No pending events</h3>
            <p className="text-folio-text-muted">All events have been reviewed</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-folio-text mb-2">{event.title}</h3>
                    <p className="text-folio-text-muted mb-4">{event.description}</p>
                    
                    <div className="flex items-center space-x-4 text-sm text-folio-text-muted">
                      <div className="flex items-center">
                        <FaCalendarAlt className="mr-2" />
                        {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="mr-2" />
                        {event.location}
                      </div>
                      <div className="flex items-center">
                        <FaUser className="mr-2" />
                        {event.createdBy.name} ({event.createdBy.companyName})
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApproval(event.id, true)}
                      disabled={actionLoading === event.id}
                      className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === event.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : (
                        <FaCheck className="mr-2" />
                      )}
                      Approve
                    </button>
                    
                    <button
                      onClick={() => handleApproval(event.id, false)}
                      disabled={actionLoading === event.id}
                      className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === event.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : (
                        <FaTimes className="mr-2" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventApprovalsPage; 