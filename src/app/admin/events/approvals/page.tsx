'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  type: string;
  isApproved: boolean | null;
  rejectionNotes?: string;
  createdBy: {
    id: string;
    name: string;
    companyName?: string;
  };
  parentFestival?: {
    id: string;
    title: string;
  };
}

interface GroupedEvents {
  [festivalId: string]: {
    festival: Event;
    events: Event[];
  };
}

export default function EventApprovalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvents>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
      return;
    }

    if ((session?.user as any)?.role !== 'admin') {
      router.push('/');
      return;
    }

    fetchEvents();
  }, [session, status, router]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/events/approvals');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data);
      groupEventsByFestival(data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupEventsByFestival = (events: Event[]) => {
    const grouped: GroupedEvents = {};
    
    events.forEach(event => {
      if (event.parentFestival) {
        const festivalId = event.parentFestival.id;
        if (!grouped[festivalId]) {
          // Find the festival event
          const festival = events.find(e => e.id === festivalId);
          if (festival) {
            grouped[festivalId] = {
              festival,
              events: []
            };
          }
        }
        if (grouped[festivalId]) {
          grouped[festivalId].events.push(event);
        }
      }
    });

    setGroupedEvents(grouped);
  };

  const handleApproval = async (eventId: string, action: 'approve' | 'reject', rejectionNotes?: string) => {
    try {
      setProcessingEventId(eventId);
      
      const response = await fetch('/api/admin/events/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          action,
          rejectionNotes: action === 'reject' ? rejectionNotes : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process approval');
      }

      const result = await response.json();
      
      // Update the local state
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === eventId 
            ? { ...event, isApproved: action === 'approve', rejectionNotes }
            : event
        )
      );

      // Refresh grouped events
      groupEventsByFestival(events.map(event => 
        event.id === eventId 
          ? { ...event, isApproved: action === 'approve', rejectionNotes }
          : event
      ));

      alert(result.message);
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Failed to process approval. Please try again.');
    } finally {
      setProcessingEventId(null);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'pending' && event.isApproved === null) ||
                         (filterStatus === 'approved' && event.isApproved === true) ||
                         (filterStatus === 'rejected' && event.isApproved === false);
    
    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (isApproved: boolean | null) => {
    if (isApproved === null) {
      return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Pending</span>;
    }
    if (isApproved) {
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Approved</span>;
    }
    return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Rejected</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Festival Sub-Event Approvals</h1>
        <p className="text-gray-600">Review and approve vendor event submissions to Design Festivals</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Events</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Events List */}
      <div className="space-y-6">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No events found matching your criteria.</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{event.title}</h3>
                  <p className="text-gray-600 mb-2">{event.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                    <div>
                      <strong>Location:</strong> {event.location}
                    </div>
                    <div>
                      <strong>Vendor:</strong> {event.createdBy.name} 
                      {event.createdBy.companyName && ` (${event.createdBy.companyName})`}
                    </div>
                    <div>
                      <strong>Start:</strong> {formatDate(event.startDate)}
                    </div>
                    <div>
                      <strong>End:</strong> {formatDate(event.endDate)}
                    </div>
                    {event.parentFestival && (
                      <div className="md:col-span-2">
                        <strong>Festival:</strong> {event.parentFestival.title}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="ml-4 flex flex-col items-end gap-2">
                  {getStatusBadge(event.isApproved)}
                </div>
              </div>

              {/* Rejection Notes */}
              {event.isApproved === false && event.rejectionNotes && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <strong className="text-red-800">Rejection Notes:</strong>
                  <p className="text-red-700 mt-1">{event.rejectionNotes}</p>
                </div>
              )}

              {/* Action Buttons */}
              {event.isApproved === null && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleApproval(event.id, 'approve')}
                    disabled={processingEventId === event.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {processingEventId === event.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : null}
                    Approve
                  </button>
                  
                  <button
                    onClick={() => {
                      const notes = prompt('Please provide rejection notes:');
                      if (notes) {
                        handleApproval(event.id, 'reject', notes);
                      }
                    }}
                    disabled={processingEventId === event.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {processingEventId === event.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : null}
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
} 