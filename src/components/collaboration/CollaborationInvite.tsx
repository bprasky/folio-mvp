'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CollaborationInviteProps {
  storyId: string;
  vendorOrg: {
    id: string;
    name: string;
    logo: string | null;
    description?: string | null;
  };
  invitedAt: string;
  onRespond?: (accepted: boolean) => void;
}

export function CollaborationInvite({
  storyId,
  vendorOrg,
  invitedAt,
  onRespond,
}: CollaborationInviteProps) {
  const [isResponding, setIsResponding] = useState(false);
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const handleRespond = async (accept: boolean) => {
    if (!accept && !showDeclineReason) {
      setShowDeclineReason(true);
      return;
    }

    setIsResponding(true);
    try {
      const res = await fetch(`/api/collaboration/stories/${storyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: accept ? 'ACCEPT' : 'DECLINE',
          declineReason: !accept ? declineReason : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to respond');
      }

      const data = await res.json();
      toast.success(data.message);
      onRespond?.(accept);
    } catch (error: any) {
      console.error('Failed to respond:', error);
      toast.error(error.message || 'Failed to respond to invitation');
    } finally {
      setIsResponding(false);
    }
  };

  const inviteDate = new Date(invitedAt);
  const formattedDate = inviteDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-surface-canvas rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-sm font-medium opacity-90">Collaboration Invitation</span>
        </div>
        <h2 className="text-xl font-semibold">
          {vendorOrg.name} wants to collaborate with you
        </h2>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Vendor Info */}
        <div className="flex items-start gap-4 mb-6">
          {vendorOrg.logo ? (
            <img
              src={vendorOrg.logo}
              alt={vendorOrg.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center">
              <span className="text-2xl font-semibold text-neutral-400">
                {vendorOrg.name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-neutral-900">{vendorOrg.name}</h3>
            {vendorOrg.description && (
              <p className="text-sm text-neutral-600 mt-1 line-clamp-2">
                {vendorOrg.description}
              </p>
            )}
            <p className="text-xs text-neutral-400 mt-2">
              Invited on {formattedDate}
            </p>
          </div>
        </div>

        {/* What is a Collaboration Story */}
        <div className="bg-neutral-50 rounded-xl p-4 mb-6">
          <h4 className="font-medium text-neutral-900 mb-2">What is a Collaboration Story?</h4>
          <ul className="text-sm text-neutral-600 space-y-2">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>A dual-interview format where both you and the vendor share perspectives</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Three rounds of questions, culminating in a cross-dialogue</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>AI weaves your answers into a cohesive narrative</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Published to the magazine with a Collaboration badge</span>
            </li>
          </ul>
        </div>

        {/* Decline Reason */}
        {showDeclineReason && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Reason for declining <span className="text-neutral-400">(optional)</span>
            </label>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Let them know why you're declining..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg resize-none h-20 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={500}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {showDeclineReason ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeclineReason(false);
                  setDeclineReason('');
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleRespond(false)}
                disabled={isResponding}
                className="flex-1"
              >
                {isResponding ? 'Declining...' : 'Confirm Decline'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleRespond(false)}
                disabled={isResponding}
                className="flex-1"
              >
                Decline
              </Button>
              <Button
                onClick={() => handleRespond(true)}
                disabled={isResponding}
                className="flex-1"
              >
                {isResponding ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
