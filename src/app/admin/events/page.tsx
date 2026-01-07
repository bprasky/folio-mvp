'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="text-gray-500">Loading events...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Breadcrumb Navigation */}
        <div className="mb-4">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link href="/admin" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600">
                  🏠 Admin Dashboard
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                  </svg>
                  <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">Manage Events</span>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Events</h1>
              <p className="text-gray-600">View and manage all events and festivals</p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/admin/festivals/create"
                className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                🎪 Create Festival
              </Link>
              <Link
                href="/admin/events/create"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                📅 Create Event
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/festivals/create"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              🎪 Create Festival
            </Link>
            <Link
              href="/admin/events/create"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              📅 Create Event
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              🏠 Admin Dashboard
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              👀 View Public Events
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All ({events.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-md ${
                filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pending ({events.filter(e => e.requiresApproval && !e.isApproved).length})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-md ${
                filter === 'approved' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Approved ({events.filter(e => e.isApproved).length})
            </button>
            <button
              onClick={() => setFilter('festivals')}
              className={`px-4 py-2 rounded-md ${
                filter === 'festivals' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Festivals ({events.filter(e => e.type === 'festival').length})
            </button>
          </div>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No events found matching your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{event.title}</div>
                          <div className="text-sm text-gray-500 line-clamp-2">{event.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.type === 'festival' ? 'bg-purple-100 text-purple-800' :
                          event.type === 'panel' ? 'bg-blue-100 text-blue-800' :
                          event.type === 'booth' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(event.startDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.createdBy.name}
                        <div className="text-xs text-gray-500">{event.createdBy.role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.isApproved ? 'bg-green-100 text-green-800' :
                          event.requiresApproval ? 'bg-yellow-100 text-yellow-800' :
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
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(event.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <Link
                            href={`/events/${event.id}`}
                            className="text-blue-600 hover:text-blue-900"
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
        </div>
      </div>
    </div>
  );
} 