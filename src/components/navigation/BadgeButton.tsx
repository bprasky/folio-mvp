'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import FolioBadgeModal from '@/components/badge/FolioBadgeModal';
import { getMonographUrl } from '@/lib/utils/getMonographUrl';
import type { UpcomingEventRSVP } from '@/app/designer/profile/types';

export function BadgeButton() {
  const { data: session, status } = useSession();
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [upcomingRSVPs, setUpcomingRSVPs] = useState<UpcomingEventRSVP[]>([]);

  // Fetch upcoming event RSVPs when badge modal opens
  useEffect(() => {
    if (!badgeOpen || !session?.user?.id) return;
    fetch('/api/users/me/upcoming-events')
      .then(res => res.ok ? res.json() : { rsvps: [] })
      .then(data => setUpcomingRSVPs(data.rsvps || []))
      .catch(() => setUpcomingRSVPs([]));
  }, [badgeOpen, session?.user?.id]);

  if (status !== 'authenticated' || !session?.user?.name) {
    return null;
  }

  const user = session.user;
  const monographUrl = getMonographUrl({ name: user.name });

  return (
    <>
      <button
        onClick={() => setBadgeOpen(true)}
        className="ridge-btn pill-btn px-3 py-2"
        title="My Folio Badge"
        aria-label="Open my Folio Badge"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="1" width="5" height="5" rx="0.5" />
          <rect x="10" y="1" width="5" height="5" rx="0.5" />
          <rect x="1" y="10" width="5" height="5" rx="0.5" />
          <rect x="10" y="10" width="2" height="2" rx="0.25" />
          <rect x="13" y="10" width="2" height="2" rx="0.25" />
          <rect x="10" y="13" width="2" height="2" rx="0.25" />
          <rect x="13" y="13" width="2" height="2" rx="0.25" />
        </svg>
      </button>

      <FolioBadgeModal
        open={badgeOpen}
        onOpenChange={setBadgeOpen}
        user={{
          name: user.name,
          title: (user as any).title || null,
          profileImage: user.image || null,
        }}
        organization={(user as any).operatingAsOrg ? { name: (user as any).operatingAsOrg.name } : null}
        tagline={(user as any).bio || null}
        monographUrl={monographUrl}
        upcomingEventRSVPs={upcomingRSVPs}
      />
    </>
  );
}
