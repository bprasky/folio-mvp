'use client';

import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaMapMarkerAlt, FaUser, FaCheck, FaTimes } from 'react-icons/fa';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';

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
      <div className="min-h-screen bg-[var(--bg-base)] pl-20 lg:pl-56">
        <div className="p-4 lg:p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--bg-elevated)] rounded mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-[var(--bg-elevated)] rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] pl-20 lg:pl-56">
      <div className="p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="folio-h1 text-[var(--text-primary)] mb-2">Event Approvals</h1>
          <p className="folio-body text-[var(--text-secondary)]">Review and approve pending events</p>
        </div>

        {events.length === 0 ? (
          <RidgeCard padding="lg">
            <div className="text-center py-8">
              <FaCalendarAlt className="mx-auto text-4xl text-[var(--text-tertiary)] mb-4" />
              <h3 className="folio-h3 text-[var(--text-primary)] mb-2">No pending events</h3>
              <p className="folio-body text-[var(--text-secondary)]">All events have been reviewed</p>
            </div>
          </RidgeCard>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <RidgeCard key={event.id} padding="lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="folio-h3 text-[var(--text-primary)] mb-2">{event.title}</h3>
                    <p className="folio-body text-[var(--text-secondary)] mb-4">{event.description}</p>

                    <div className="flex items-center flex-wrap gap-4 folio-meta text-[var(--text-tertiary)]">
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

                  <div className="flex space-x-2 ml-4">
                    <Button
                      onClick={() => handleApproval(event.id, true)}
                      disabled={actionLoading === event.id}
                      variant="accent"
                      size="sm"
                    >
                      {actionLoading === event.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : (
                        <FaCheck className="mr-2" />
                      )}
                      Approve
                    </Button>

                    <Button
                      onClick={() => handleApproval(event.id, false)}
                      disabled={actionLoading === event.id}
                      variant="destructive"
                      size="sm"
                    >
                      {actionLoading === event.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : (
                        <FaTimes className="mr-2" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              </RidgeCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventApprovalsPage;
