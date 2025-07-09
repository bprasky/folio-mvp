'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FaPlus, 
  FaEdit, 
  FaEye, 
  FaTrash, 
  FaCalendar, 
  FaMapMarkerAlt, 
  FaUsers,
  FaEyeSlash,
  FaTicketAlt,
  FaEnvelope,
  FaCheck,
  FaTimes
} from 'react-icons/fa';

interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location: string;
  type: string;
  status: string;
  isSignature: boolean;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  subEvents: SubEvent[];
  _count: {
    subEvents: number;
  };
}

interface SubEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  type: string;
  visibility: string;
  ticketingType: string;
  maxAttendees?: number;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  subEventRSVPs: any[];
  subEventInvites: any[];
  _count: {
    subEventRSVPs: number;
    subEventInvites: number;
  };
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubEventModal, setShowSubEventModal] = useState(false);
  const [selectedSubEvent, setSelectedSubEvent] = useState<SubEvent | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/admin/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      } else {
        console.error('Failed to fetch events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (eventData: any) => {
    try {
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        await fetchEvents();
        setShowCreateModal(false);
      } else {
        const error = await response.json();
        alert(`Failed to create event: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    }
  };

  const handleUpdateSubEvent = async (subEventId: string, updates: any) => {
    try {
      const response = await fetch(`/api/subevents/${subEventId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchEvents();
        setShowSubEventModal(false);
        setSelectedSubEvent(null);
      } else {
        const error = await response.json();
        alert(`Failed to update sub-event: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating sub-event:', error);
      alert('Failed to update sub-event');
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return <FaEye className="text-green-500" />;
      case 'invite-only': return <FaEnvelope className="text-yellow-500" />;
      case 'hidden': return <FaEyeSlash className="text-red-500" />;
      default: return <FaEye className="text-gray-500" />;
    }
  };

  const getTicketingIcon = (ticketingType: string) => {
    switch (ticketingType) {
      case 'open': return <FaTicketAlt className="text-green-500" />;
      case 'rsvp': return <FaCheck className="text-blue-500" />;
      case 'paid': return <FaTicketAlt className="text-purple-500" />;
      default: return <FaTicketAlt className="text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Event Management</h1>
            <p className="text-gray-600 mt-2">Manage design festivals and events</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Create Event
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FaCalendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{events.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaUsers className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.filter(e => e.status === 'active').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaTicketAlt className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sub-Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.reduce((sum, e) => sum + e._count.subEvents, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FaMapMarkerAlt className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Signature Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {events.filter(e => e.isSignature).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Events</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {events.map((event) => (
              <div key={event.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
                      {event.isSignature && (
                        <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          Signature
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${
                        event.status === 'active' ? 'bg-green-100 text-green-800' :
                        event.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{event.description}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <FaCalendar className="w-4 h-4" />
                        <span>{new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaMapMarkerAlt className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaUsers className="w-4 h-4" />
                        <span>{event._count.subEvents} sub-events</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedEvent(event)}
                      className="text-blue-600 hover:text-blue-800 p-2"
                    >
                      <FaEye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                      className="text-gray-600 hover:text-gray-800 p-2"
                    >
                      <FaEdit className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-Events */}
                {selectedEvent?.id === event.id && event.subEvents.length > 0 && (
                  <div className="mt-6 bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-4">Sub-Events</h4>
                    <div className="space-y-3">
                      {event.subEvents.map((subEvent) => (
                        <div key={subEvent.id} className="flex justify-between items-center bg-white rounded-lg p-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-medium text-gray-900">{subEvent.title}</h5>
                              {getVisibilityIcon(subEvent.visibility)}
                              {getTicketingIcon(subEvent.ticketingType)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>{new Date(subEvent.startTime).toLocaleString()}</span>
                              <span>{subEvent.location}</span>
                              <span>{subEvent._count.subEventRSVPs} RSVPs</span>
                              <span>{subEvent._count.subEventInvites} Invites</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedSubEvent(subEvent);
                                setShowSubEventModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 p-1"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create Event Modal */}
        {showCreateModal && (
          <CreateEventModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateEvent}
          />
        )}

        {/* Edit Sub-Event Modal */}
        {showSubEventModal && selectedSubEvent && (
          <EditSubEventModal
            subEvent={selectedSubEvent}
            onClose={() => {
              setShowSubEventModal(false);
              setSelectedSubEvent(null);
            }}
            onSubmit={handleUpdateSubEvent}
          />
        )}
      </div>
    </div>
  );
}

// Create Event Modal Component
function CreateEventModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    type: 'general',
    isSignature: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create New Event</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="datetime-local"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="datetime-local"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="general">General</option>
              <option value="signature">Signature</option>
              <option value="design-week">Design Week</option>
              <option value="festival">Festival</option>
              <option value="trade-show">Trade Show</option>
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isSignature"
              checked={formData.isSignature}
              onChange={(e) => setFormData({ ...formData, isSignature: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="isSignature" className="text-sm font-medium text-gray-700">
              Signature Event
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Sub-Event Modal Component
function EditSubEventModal({ 
  subEvent, 
  onClose, 
  onSubmit 
}: { 
  subEvent: SubEvent; 
  onClose: () => void; 
  onSubmit: (id: string, data: any) => void;
}) {
  const [formData, setFormData] = useState({
    visibility: subEvent.visibility,
    ticketingType: subEvent.ticketingType,
    maxAttendees: subEvent.maxAttendees || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(subEvent.id, formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Edit Sub-Event: {subEvent.title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="public">Public</option>
              <option value="invite-only">Invite Only</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticketing Type</label>
            <select
              value={formData.ticketingType}
              onChange={(e) => setFormData({ ...formData, ticketingType: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="open">Open</option>
              <option value="rsvp">RSVP Required</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Attendees</label>
            <input
              type="number"
              value={formData.maxAttendees}
              onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Leave empty for unlimited"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update Sub-Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 