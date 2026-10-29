'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import FolioBadgeModal from '@/components/badge/FolioBadgeModal';
import { getMonographUrl } from '@/lib/utils/getMonographUrl';
import type { UpcomingEventRSVP } from '@/app/designer/profile/types';
import { QrCode } from 'lucide-react';
import styles from './navigation.module.css';

export function BadgeButton({ onOpen }: { onOpen?: () => void }) {
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
        type="button"
        onClick={() => { setBadgeOpen(true); onOpen?.(); }}
        className={styles.menuAction}
        aria-label="Open my Folio Badge"
      >
        <QrCode size={16} strokeWidth={1.5} aria-hidden="true" />
        My Folio Badge
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
