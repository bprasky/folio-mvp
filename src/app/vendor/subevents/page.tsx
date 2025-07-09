'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FaPlus, 
  FaEdit, 
  FaEye, 
  FaCalendar, 
  FaMapMarkerAlt, 
  FaUsers,
  FaEyeSlash,
  FaTicketAlt,
  FaEnvelope,
  FaCheck,
  FaTrash
} from 'react-icons/fa';

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
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  };
  subEventRSVPs: any[];
  subEventInvites: any[];
  _count: {
    subEventRSVPs: number;
    subEventInvites: number;
  };
}

export default function VendorSubEventsPage() {
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedSubEvent, setSelectedSubEvent] = useState<SubEvent | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchSubEvents();
  }, []);

  const fetchSubEvents = async () => {
    try {
      const response = await fetch('/api/vendor/subevents');
      if (response.ok) {
        const data = await response.json();
        setSubEvents(data);
      } else {
        console.error('Failed to fetch sub-events');
      }
    } catch (error) {
      console.error('Error fetching sub-events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubEvent = async (subEventData: any) => {
    try {
      const response = await fetch('/api/vendor/subevents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subEventData),
      });

      if (response.ok) {
        await fetchSubEvents();
        setShowCreateModal(false);
      } else {
        const error = await response.json();
        alert(`Failed to create sub-event: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating sub-event:', error);
      alert('Failed to create sub-event');
    }
  };

  const handleSendInvite = async (subEventId: string, email: string, message?: string) => {
    try {
      const response = await fetch(`/api/subevents/${subEventId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      });

      if (response.ok) {
        alert('Invite sent successfully!');
        setShowInviteModal(false);
        setSelectedSubEvent(null);
      } else {
        const error = await response.json();
        alert(`Failed to send invite: ${error.error}`);
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to send invite');
    }
  };

  const handleUpdateVisibility = async (subEventId: string, visibility: string) => {
    try {
      const response = await fetch(`/api/subevents/${subEventId}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      });

      if (response.ok) {
        await fetchSubEvents();
      } else {
        const error = await response.json();
        alert(`Failed to update visibility: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      alert('Failed to update visibility');
    }
  };

  const handleUpdateTicketing = async (subEventId: string, ticketingType: string) => {
    try {
      const response = await fetch(`/api/subevents/${subEventId}/ticketing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketingType }),
      });

      if (response.ok) {
        await fetchSubEvents();
      } else {
        const error = await response.json();
        alert(`Failed to update ticketing: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating ticketing:', error);
      alert('Failed to update ticketing');
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
            <h1 className="text-3xl font-bold text-gray-900">Sub-Event Management</h1>
            <p className="text-gray-600 mt-2">Manage your sub-events within festivals</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="w-4 h-4" />
            Create Sub-Event
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
                <p className="text-sm font-medium text-gray-600">Total Sub-Events</p>
                <p className="text-2xl font-bold text-gray-900">{subEvents.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaUsers className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total RSVPs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {subEvents.reduce((sum, se) => sum + se._count.subEventRSVPs, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaEnvelope className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Invites</p>
                <p className="text-2xl font-bold text-gray-900">
                  {subEvents.reduce((sum, se) => sum + se._count.subEventInvites, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FaTicketAlt className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Public Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {subEvents.filter(se => se.visibility === 'public').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Events List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Sub-Events</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {subEvents.map((subEvent) => (
              <div key={subEvent.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{subEvent.title}</h3>
                      {getVisibilityIcon(subEvent.visibility)}
                      {getTicketingIcon(subEvent.ticketingType)}
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {subEvent.type}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{subEvent.description}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <FaCalendar className="w-4 h-4" />
                        <span>{new Date(subEvent.startTime).toLocaleString()}</span>
                      </div>
                      {subEvent.location && (
                        <div className="flex items-center gap-1">
                          <FaMapMarkerAlt className="w-4 h-4" />
                          <span>{subEvent.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <FaUsers className="w-4 h-4" />
                        <span>{subEvent._count.subEventRSVPs} RSVPs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FaEnvelope className="w-4 h-4" />
                        <span>{subEvent._count.subEventInvites} Invites</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">Event:</span> {subEvent.event.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedSubEvent(subEvent);
                        setShowInviteModal(true);
                      }}
                      className="text-green-600 hover:text-green-800 p-2"
                      title="Send Invite"
                    >
                      <FaEnvelope className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => router.push(`/vendor/subevents/${subEvent.id}`)}
                      className="text-blue-600 hover:text-blue-800 p-2"
                      title="View Details"
                    >
                      <FaEye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => router.push(`/vendor/subevents/${subEvent.id}/edit`)}
                      className="text-gray-600 hover:text-gray-800 p-2"
                      title="Edit"
                    >
                      <FaEdit className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Visibility:</span>
                    <select
                      value={subEvent.visibility}
                      onChange={(e) => handleUpdateVisibility(subEvent.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="public">Public</option>
                      <option value="invite-only">Invite Only</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Ticketing:</span>
                    <select
                      value={subEvent.ticketingType}
                      onChange={(e) => handleUpdateTicketing(subEvent.id, e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="open">Open</option>
                      <option value="rsvp">RSVP Required</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Sub-Event Modal */}
        {showCreateModal && (
          <CreateSubEventModal
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateSubEvent}
          />
        )}

        {/* Send Invite Modal */}
        {showInviteModal && selectedSubEvent && (
          <SendInviteModal
            subEvent={selectedSubEvent}
            onClose={() => {
              setShowInviteModal(false);
              setSelectedSubEvent(null);
            }}
            onSubmit={handleSendInvite}
          />
        )}
      </div>
    </div>
  );
}

// Create Sub-Event Modal Component
function CreateSubEventModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventId: '',
    startTime: '',
    endTime: '',
    location: '',
    type: 'talk',
    visibility: 'public',
    ticketingType: 'open',
    maxAttendees: '',
  });

  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/events?filter=all');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create New Sub-Event</h2>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
            <select
              required
              value={formData.eventId}
              onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Select an event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="datetime-local"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="datetime-local"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Room, booth number, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="talk">Talk</option>
              <option value="panel">Panel</option>
              <option value="booth">Booth</option>
              <option value="workshop">Workshop</option>
              <option value="networking">Networking</option>
              <option value="dinner">Dinner</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticketing</label>
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
              Create Sub-Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Send Invite Modal Component
function SendInviteModal({ 
  subEvent, 
  onClose, 
  onSubmit 
}: { 
  subEvent: SubEvent; 
  onClose: () => void; 
  onSubmit: (id: string, email: string, message?: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(subEvent.id, email, message);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Send Invite</h2>
        <p className="text-gray-600 mb-4">
          Send an invite for: <strong>{subEvent.title}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="designer@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
              placeholder="Personal message to include with the invite..."
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 