'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  requiresApproval: boolean;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  parentFestival?: {
    id: string;
    title: string;
  };
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'festivals'>('all');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const [eventsRes, festivalsRes] = await Promise.all([
        fetch('/api/admin/events'),
        fetch('/api/admin/festivals')
      ]);

      const eventsData = await eventsRes.json();
      const festivalsData = await festivalsRes.json();

      // Combine events and festivals
      const allEvents = [...festivalsData, ...eventsData];
      setEvents(allEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (eventId: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}/approve`, {
        method: 'POST'
      });

      if (response.ok) {
        fetchEvents(); // Refresh the list
      }
    } catch (error) {
      console.error('Error approving event:', error);
    }
  };

  const handleReject = async (eventId: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Rejected by admin' })
      });

      if (response.ok) {
        fetchEvents(); // Refresh the list
      }
    } catch (error) {
      console.error('Error rejecting event:', error);
    }
  };

  const filteredEvents = events.filter(event => {
    switch (filter) {
      case 'pending':
        return event.requiresApproval && !event.isApproved;
      case 'approved':
        return event.isApproved;
      case 'festivals':
        return event.type === 'festival';
      default:
        return true;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-canvas py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="text-folio-text-secondary">Loading events...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Breadcrumb Navigation */}
        <div className="mb-4">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link href="/admin" className="inline-flex items-center folio-meta text-[var(--accent)] hover:text-[var(--accent-hover)]">
                  Admin Dashboard
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-folio-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                  </svg>
                  <span className="ml-1 folio-meta text-folio-text-secondary md:ml-2">Manage Events</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="folio-h1 mb-2">Manage Events</h1>
              <p className="folio-body">View and manage all events and festivals</p>
            </div>
            <div className="flex space-x-3">
              <Link href="/admin/festivals/create">
                <Button variant="accent">
                  Create Festival
                </Button>
              </Link>
              <Link href="/admin/events/create">
                <Button variant="ridge">
                  Create Event
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <RidgeCard padding="md" className="mb-6">
          <h3 className="folio-h3 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/festivals/create">
              <Button variant="accent" size="sm">
                Create Festival
              </Button>
            </Link>
            <Link href="/admin/events/create">
              <Button variant="ridge" size="sm">
                Create Event
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="ridge" size="sm">
                Admin Dashboard
              </Button>
            </Link>
            <Link href="/events">
              <Button variant="ridge" size="sm">
                View Public Events
              </Button>
            </Link>
          </div>
        </RidgeCard>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex space-x-4">
            <Button
              variant={filter === 'all' ? 'accent' : 'ridge'}
              onClick={() => setFilter('all')}
            >
              All ({events.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'accent' : 'ridge'}
              onClick={() => setFilter('pending')}
            >
              Pending ({events.filter(e => e.requiresApproval && !e.isApproved).length})
            </Button>
            <Button
              variant={filter === 'approved' ? 'accent' : 'ridge'}
              onClick={() => setFilter('approved')}
            >
              Approved ({events.filter(e => e.isApproved).length})
            </Button>
            <Button
              variant={filter === 'festivals' ? 'accent' : 'ridge'}
              onClick={() => setFilter('festivals')}
            >
              Festivals ({events.filter(e => e.type === 'festival').length})
            </Button>
          </div>
        </div>

        {/* Events List */}
        <RidgeCard padding="none" className="overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-folio-text-secondary">
              No events found matching your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border-subtle)]">
                <thead className="bg-surface-ground">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-folio-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-surface-canvas divide-y divide-[var(--border-subtle)]">
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-surface-ground/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-folio-text-primary">{event.title}</div>
                          <div className="text-sm text-folio-text-secondary line-clamp-2">{event.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.type === 'festival' ? 'bg-purple-100 text-purple-800' :
                          event.type === 'panel' ? 'bg-blue-100 text-blue-800' :
                          event.type === 'booth' ? 'bg-green-100 text-green-800' :
                          'bg-surface-ground text-folio-text-primary'
                        }`}>
                          {event.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-primary">
                        {event.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-primary">
                        {formatDate(event.startDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-folio-text-primary">
                        {event.createdBy.name}
                        <div className="text-xs text-folio-text-secondary">{event.createdBy.role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.isApproved ? 'bg-green-100 text-green-800' :
                          event.requiresApproval ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {event.isApproved ? 'Approved' : event.requiresApproval ? 'Pending' : 'Rejected'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {event.requiresApproval && !event.isApproved && (
                            <>
                              <button
                                onClick={() => handleApprove(event.id)}
                                className="text-green-600 hover:text-green-800"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(event.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <Link
                            href={`/events/${event.id}`}
                            className="text-[var(--accent)] hover:text-[var(--accent-hover)]"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RidgeCard>
      </div>
    </div>
  );
}
