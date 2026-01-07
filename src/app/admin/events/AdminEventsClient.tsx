'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FaCalendarAlt, FaPlus, FaCheck, FaTimes, FaEye, FaUsers } from 'react-icons/fa';

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  type: string;
  isPublic: boolean;
  isApproved: boolean | null;
  createdBy: {
    id: string;
    name: string;
    companyName: string | null;
  };
  parentFestival?: {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
  } | null;
  subevents: {
    id: string;
    title: string;
    type: string;
    isApproved: boolean | null;
  }[];
  _count: {
    subevents: number;
  };
}

interface EventStats {
  total: number;
  festivals: number;
  approved: number;
  pending: number;
  rejected: number;
}

interface AdminEventsClientProps {
  events: Event[];
  stats: EventStats;
  userId: string;
}

const AdminEventsClient: React.FC<AdminEventsClientProps> = ({ events, stats, userId }) => {
  const [filter, setFilter] = useState<'all' | 'festivals' | 'approved' | 'pending' | 'rejected'>('all');
  const [loading, setLoading] = useState<string | null>(null);

  const handleApprove = async (eventId: string) => {
    setLoading(eventId);
    try {
      const response = await fetch('/api/admin/events/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId, action: 'approve' }),
      });

      if (response.ok) {
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        alert('Failed to approve event');
      }
    } catch (error) {
      console.error('Error approving event:', error);
      alert('Error approving event');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (eventId: string) => {
    setLoading(eventId);
    try {
      const response = await fetch('/api/admin/events/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId, action: 'reject' }),
      });

      if (response.ok) {
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        alert('Failed to reject event');
      }
    } catch (error) {
      console.error('Error rejecting event:', error);
      alert('Error rejecting event');
    } finally {
      setLoading(null);
    }
  };

  const filteredEvents = events.filter(event => {
    switch (filter) {
      case 'festivals':
        return event.type === 'festival';
      case 'approved':
        return event.isApproved === true;
      case 'pending':
        return event.isApproved === false;
      case 'rejected':
        return event.isApproved === null;
      default:
        return true;
    }
  });

  const getStatusColor = (isApproved: boolean | null) => {
    if (isApproved === true) return 'bg-green-100 text-green-800';
    if (isApproved === false) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusLabel = (isApproved: boolean | null) => {
    if (isApproved === true) return 'Approved';
    if (isApproved === false) return 'Pending';
    return 'Rejected';
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'festival': return '🎪';
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-folio-text mb-2">Event Management</h1>
          <p className="text-folio-text-muted">Manage festivals, events, and vendor submissions</p>
        </div>
        
        <Link
          href="/admin/events/create"
          className="flex items-center px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors mt-4 lg:mt-0"
        >
          <FaPlus className="mr-2" />
          Create Festival or Event
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-folio-border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
              <FaCalendarAlt className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-folio-text">{stats.total}</p>
              <p className="text-folio-text-muted">Total Events</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-folio-border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4">
              <span className="text-xl">🎪</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-folio-text">{stats.festivals}</p>
              <p className="text-folio-text-muted">Festivals</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-folio-border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
              <FaCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-folio-text">{stats.approved}</p>
              <p className="text-folio-text-muted">Approved</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-folio-border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 mr-4">
              <FaCalendarAlt className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-folio-text">{stats.pending}</p>
              <p className="text-folio-text-muted">Pending</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-folio-border">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-600 mr-4">
              <FaTimes className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-folio-text">{stats.rejected}</p>
              <p className="text-folio-text-muted">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All Events' },
          { key: 'festivals', label: 'Festivals' },
          { key: 'approved', label: 'Approved' },
          { key: 'pending', label: 'Pending' },
          { key: 'rejected', label: 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === tab.key
                ? 'bg-folio-accent text-white'
                : 'bg-white text-folio-text hover:bg-folio-muted border border-folio-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-folio-border p-12">
          <div className="text-center">
            <FaCalendarAlt className="mx-auto h-12 w-12 text-folio-text-muted mb-4" />
            <h3 className="text-lg font-medium text-folio-text mb-2">No events found</h3>
            <p className="text-folio-text-muted mb-6">
              {filter === 'all' ? 'No events have been created yet.' : `No ${filter} events found.`}
            </p>
            <Link
              href="/admin/events/create"
              className="inline-flex items-center px-4 py-2 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
            >
              <FaPlus className="mr-2" />
              Create Your First Event
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
              {/* Event Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{getTypeIcon(event.type)}</span>
                  <div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(event.isApproved)}`}>
                      {getStatusLabel(event.isApproved)}
                    </span>
                    {event.type === 'festival' && (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full ml-2">
                        Festival
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Link
                    href={`/events/${event.id}`}
                    className="p-2 text-folio-text-muted hover:text-folio-accent transition-colors"
                  >
                    <FaEye className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Event Content */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-folio-text mb-2 line-clamp-2">
                  {event.title}
                </h3>
                <p className="text-folio-text-muted text-sm mb-3 line-clamp-3">
                  {event.description}
                </p>
                
                <div className="space-y-1">
                  <div className="flex items-center text-sm text-folio-text-muted">
                    <FaCalendarAlt className="w-4 h-4 mr-2" />
                    {formatDate(event.startDate)} - {formatDate(event.endDate)}
                  </div>
                  <div className="flex items-center text-sm text-folio-text-muted">
                    <span className="w-4 h-4 mr-2">📍</span>
                    {event.location}
                  </div>
                  <div className="flex items-center text-sm text-folio-text-muted">
                    <FaUsers className="w-4 h-4 mr-2" />
                    {event.createdBy.name} {event.createdBy.companyName && `(${event.createdBy.companyName})`}
                  </div>
                  {event.type === 'festival' && (
                    <div className="flex items-center text-sm text-folio-text-muted">
                      <span className="w-4 h-4 mr-2">🎪</span>
                      {event._count.subevents} sub-events
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {event.isApproved === false && (
                <div className="flex space-x-2 pt-4 border-t border-folio-border">
                  <button
                    onClick={() => handleApprove(event.id)}
                    disabled={loading === event.id}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <FaCheck className="mr-2" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(event.id)}
                    disabled={loading === event.id}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <FaTimes className="mr-2" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEventsClient; 