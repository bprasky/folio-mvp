'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  FaCalendar, 
  FaMapMarkerAlt, 
  FaUsers, 
  FaEnvelope,
  FaCheck,
  FaTimes,
  FaSpinner
} from 'react-icons/fa';

interface Invite {
  id: string;
  email: string;
  status: string;
  message?: string;
  expiresAt: string;
  subEvent: {
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    type: string;
    event: {
      id: string;
      title: string;
    };
  };
  invitedBy: {
    name: string;
  };
}

export default function InviteAcceptPage() {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    website: '',
  });
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  useEffect(() => {
    if (token) {
      validateInvite();
    }
  }, [token]);

  const validateInvite = async () => {
    try {
      const response = await fetch(`/api/invites/accept/${token}`);
      const data = await response.json();

      if (data.valid) {
        setInvite(data.invite);
        setFormData({
          name: '',
          email: data.invite.email,
          website: '',
        });
      } else {
        setError(data.error || 'Invalid invite');
      }
    } catch (error) {
      console.error('Error validating invite:', error);
      setError('Failed to validate invite');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccepting(true);

    try {
      const response = await fetch(`/api/invites/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to onboarding or dashboard
        router.push(`/designer/onboarding-complete?userId=${data.user.id}`);
      } else {
        setError(data.error || 'Failed to accept invite');
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      setError('Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTimes className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Invalid invitation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">You're Invited!</h1>
          <p className="text-gray-600">
            {invite.invitedBy.name} has invited you to attend an exclusive event
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Event Details */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Details</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-1">{invite.subEvent.title}</h3>
                <p className="text-sm text-gray-600">{invite.subEvent.description}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FaCalendar className="w-4 h-4" />
                  <span>
                    {new Date(invite.subEvent.startTime).toLocaleDateString()} at{' '}
                    {new Date(invite.subEvent.startTime).toLocaleTimeString()}
                  </span>
                </div>

                {invite.subEvent.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FaMapMarkerAlt className="w-4 h-4" />
                    <span>{invite.subEvent.location}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FaUsers className="w-4 h-4" />
                  <span>{invite.subEvent.event.title}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FaEnvelope className="w-4 h-4" />
                  <span>Invited by {invite.invitedBy.name}</span>
                </div>
              </div>

              {invite.message && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">{invite.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* Accept Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Accept Invitation</h2>
            
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website (Optional)
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://yourwebsite.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll use this to automatically import your portfolio
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={accepting}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {accepting ? (
                    <>
                      <FaSpinner className="w-4 h-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <FaCheck className="w-4 h-4" />
                      Accept Invitation
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                By accepting this invitation, you'll create a designer account and be automatically RSVP'd to this event.
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            This invitation expires on {new Date(invite.expiresAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
} 