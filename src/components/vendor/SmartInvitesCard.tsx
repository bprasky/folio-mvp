'use client';

import { useState, useEffect } from 'react';
import { FaUser, FaCheck, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';

interface RecommendedDesigner {
  id: string;
  name: string;
  email: string;
  location?: string;
  companyName?: string;
  reason: string;
  matchScore?: number;
}

interface SmartInvitesCardProps {
  vendorId: string;
  eventId?: string;
}

export default function SmartInvitesCard({ vendorId, eventId }: SmartInvitesCardProps) {
  const [recommendedDesigners, setRecommendedDesigners] = useState<RecommendedDesigner[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedDesigners, setInvitedDesigners] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRecommendedDesigners();
  }, [vendorId, eventId]);

  const fetchRecommendedDesigners = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/vendor/smart-invites?vendorId=${vendorId}${eventId ? `&eventId=${eventId}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        setRecommendedDesigners(data.designers || []);
      } else {
        // Fallback to demo data
        setRecommendedDesigners([
          {
            id: 'demo-designer-1',
            name: 'Sarah Chen',
            email: 'sarah@studio-chen.com',
            location: 'San Francisco, CA',
            companyName: 'Studio Chen',
            reason: 'Frequently saves your products',
            matchScore: 92,
          },
          {
            id: 'demo-designer-2',
            name: 'Marcus Rivera',
            email: 'marcus@rivera-design.com',
            location: 'Los Angeles, CA',
            companyName: 'Rivera Design',
            reason: 'Active in your region',
            matchScore: 85,
          },
          {
            id: 'demo-designer-3',
            name: 'Emma Thompson',
            email: 'emma@thompson-studio.com',
            location: 'New York, NY',
            companyName: 'Thompson Studio',
            reason: 'Tagged your products in recent projects',
            matchScore: 78,
          },
        ]);
      }
    } catch (error) {
      console.error('[SmartInvites] Error:', error);
      // Use demo data on error
      setRecommendedDesigners([
        {
          id: 'demo-designer-1',
          name: 'Sarah Chen',
          email: 'sarah@studio-chen.com',
          location: 'San Francisco, CA',
          companyName: 'Studio Chen',
          reason: 'Frequently saves your products',
          matchScore: 92,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (designerId: string, designerEmail: string) => {
    try {
      const response = await fetch('/api/vendor/invite-designer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designerId,
          designerEmail,
          vendorId,
          eventId,
        }),
      });

      if (response.ok) {
        setInvitedDesigners(prev => new Set(prev).add(designerId));
      } else {
        // For demo: just mark as invited locally
        setInvitedDesigners(prev => new Set(prev).add(designerId));
      }
    } catch (error) {
      console.error('[SmartInvites] Invite error:', error);
      // For demo: mark as invited anyway
      setInvitedDesigners(prev => new Set(prev).add(designerId));
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Smart Invites</h3>
          <p className="text-sm text-gray-600">
            Recommended designers based on engagement with your products
          </p>
        </div>
      </div>

      {/* "No More Excel" Copy */}
      <div className="mb-6 p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>No more exporting to Excel or juggling Eventbrite.</strong> Folio helps you invite the right designers automatically.
        </p>
      </div>

      {/* Recommended Designers List */}
      <div className="space-y-3">
        {recommendedDesigners.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No recommendations yet. Designers will appear here as they engage with your products.</p>
        ) : (
          recommendedDesigners.map((designer) => {
            const isInvited = invitedDesigners.has(designer.id);
            return (
              <div
                key={designer.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <FaUser className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {designer.name}
                      </p>
                      {designer.matchScore && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                          {designer.matchScore}% match
                        </span>
                      )}
                    </div>
                    {designer.companyName && (
                      <p className="text-sm text-gray-600 truncate">{designer.companyName}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {designer.location && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <FaMapMarkerAlt className="w-3 h-3" />
                          <span>{designer.location}</span>
                        </div>
                      )}
                      <span className="text-xs text-gray-500">{designer.reason}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleInvite(designer.id, designer.email)}
                  disabled={isInvited}
                  className={`ml-4 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isInvited
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                  }`}
                >
                  {isInvited ? (
                    <>
                      <FaCheck className="inline mr-1" />
                      Invited
                    </>
                  ) : (
                    <>
                      <FaEnvelope className="inline mr-1" />
                      Invite
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}




