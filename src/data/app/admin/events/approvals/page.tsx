"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  isApproved: boolean;
  requiresApproval: boolean;
  parentFestivalId: string | null;
  createdBy: {
    id: string;
    name: string;
    companyName?: string;
  };
  parentFestival?: {
    id: string;
    title: string;
    startDate: string;
  };
}

interface GroupedEvents {
  [festivalId: string]: {
    festival: Event['parentFestival'];
    events: Event[];
  };
}

export default function AdminEventApprovals() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvents>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState<{ [eventId: string]: string }>({});
  const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null);
  const [processingEvent, setProcessingEvent] = useState<string | null>(null);

  // Check authentication and admin role
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    
    if (session.user.role !== 'admin') {
      alert('Access denied. Admin role required.');
      router.push('/');
      return;
    }
    
    fetchEvents();
  }, [session, status, router]);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/events/approvals?filter=${filter}`);
      if (response.status === 403) {
        alert('Access denied. Admin role required.');
        router.push('/');
        return;
      }
      const data = await response.json();
      setEvents(data);
      
      // Group events by festival
      const grouped: GroupedEvents = {};
      data.forEach((event: Event) => {
        const festivalId = event.parentFestivalId || 'standalone';
        if (!grouped[festivalId]) {
          grouped[festivalId] = {
            festival: event.parentFestival,
            events: []
          };
        }
        grouped[festivalId].events.push(event);
      });
      setGroupedEvents(grouped);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter events by search
  const filteredGroupedEvents = Object.entries(groupedEvents).reduce((acc, [festivalId, group]) => {
    const filteredEvents = group.events.filter(event =>
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.createdBy.name.toLowerCase().includes(search.toLowerCase()) ||
      (event.createdBy.companyName && event.createdBy.companyName.toLowerCase().includes(search.toLowerCase()))
    );
    
    if (filteredEvents.length > 0) {
      acc[festivalId] = { ...group, events: filteredEvents };
    }
    return acc;
  }, {} as GroupedEvents);

  const handleApprove = async (eventId: string) => {
    setProcessingEvent(eventId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/events/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action: 'approve' })
      });
      
      if (response.ok) {
        // Update local state
        setEvents(prev => prev.map(event => 
          event.id === eventId ? { ...event, isApproved: true } : event
        ));
        // Show success toast (you can implement your own toast system)
        alert('Event approved and now public');
        fetchEvents(); // Refresh data
      }
    } catch (error) {
      console.error('Error approving event:', error);
      alert('Error approving event');
    } finally {
      setProcessingEvent(null);
    }
  };

  const handleReject = async (eventId: string) => {
    const notes = rejectionNotes[eventId] || '';
    setProcessingEvent(eventId);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/events/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action: 'reject', notes })
      });
      
      if (response.ok) {
        // Update local state
        setEvents(prev => prev.map(event => 
          event.id === eventId ? { ...event, isApproved: false } : event
        ));
        alert('Event rejected');
        setShowRejectionModal(null);
        setRejectionNotes(prev => ({ ...prev, [eventId]: '' }));
        fetchEvents(); // Refresh data
      }
    } catch (error) {
      console.error('Error rejecting event:', error);
      alert('Error rejecting event');
    } finally {
      setProcessingEvent(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Event Approvals</h1>
        <div className="flex gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'pending' | 'all')}
            className="border rounded px-3 py-2"
          >
            <option value="pending">Pending Approval</option>
            <option value="all">All Submitted</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search events, vendors, or companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border rounded px-4 py-2"
        />
      </div>

      {/* Events List */}
      <div className="space-y-8">
        {Object.entries(filteredGroupedEvents).map(([festivalId, group]) => (
          <div key={festivalId} className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {group.festival ? group.festival.title : 'Standalone Events'}
              </h2>
              {group.festival && (
                <p className="text-gray-600 mt-1">
                  {formatDate(group.festival.startDate)}
                </p>
              )}
            </div>
            
            <div className="divide-y">
              {group.events.map((event) => (
                <div key={event.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium">{event.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${
                          event.isApproved === null ? 'bg-yellow-100 text-yellow-800' :
                          event.isApproved ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {event.isApproved === null ? 'Pending' :
                           event.isApproved ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                      
                      <div className="text-gray-600 mb-3">
                        <p><strong>Vendor:</strong> {event.createdBy.name}</p>
                        {event.createdBy.companyName && (
                          <p><strong>Company:</strong> {event.createdBy.companyName}</p>
                        )}
                        <p><strong>Location:</strong> {event.location}</p>
                        <p><strong>Dates:</strong> {formatDate(event.startDate)} - {formatDate(event.endDate)}</p>
                      </div>
                      
                      <p className="text-gray-700 line-clamp-2">
                        {event.description}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      {event.isApproved === null && (
                        <>
                          <button
                            onClick={() => handleApprove(event.id)}
                            disabled={processingEvent === event.id}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {processingEvent === event.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => setShowRejectionModal(event.id)}
                            disabled={processingEvent === event.id}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => router.push(`/events/${event.id}`)}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {Object.keys(filteredGroupedEvents).length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {search ? 'No events found matching your search.' : 'No events requiring approval.'}
            </p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject Event</h3>
            <textarea
              placeholder="Optional rejection notes..."
              value={rejectionNotes[showRejectionModal] || ''}
              onChange={(e) => setRejectionNotes(prev => ({
                ...prev,
                [showRejectionModal]: e.target.value
              }))}
              className="w-full border rounded px-3 py-2 mb-4 h-24 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRejectionModal(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(showRejectionModal)}
                disabled={processingEvent === showRejectionModal}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {processingEvent === showRejectionModal ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 