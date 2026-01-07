'use client';

/**
 * Vendor Cinematic Intro Wrapper
 * 
 * Shows the Vendor intro for demo@folio.com when they first visit as Vendor role.
 * Uses localStorage to ensure it only shows once per browser session.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { normalizeRole } from '@/lib/permissions';
import RoleCinematicIntro from './RoleCinematicIntro';
import { VENDOR_INTRO_SECTIONS } from './introConfig';

const INTRO_SHOWN_KEY = 'folioDemoVendorIntroShown';

export default function VendorCinematicIntro() {
  const { data: session } = useSession();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !session?.user) return;

    const userEmail = session.user.email;
    const role = normalizeRole(session.user.role);
    const isDemoVendor = userEmail === 'demo@folio.com' && role === 'VENDOR';
    const alreadyShown = localStorage.getItem(INTRO_SHOWN_KEY) === 'true';

    // Show intro if: demo user, Vendor role, and not shown before
    if (isDemoVendor && !alreadyShown) {
      setShowIntro(true);
    }
  }, [session]);

  const handleContinue = () => {
    localStorage.setItem(INTRO_SHOWN_KEY, 'true');
    setShowIntro(false);
  };

  if (!showIntro) return null;

  return (
    <RoleCinematicIntro
      role="vendor"
      sections={VENDOR_INTRO_SECTIONS}
      onContinue={handleContinue}
      onClose={handleContinue}
    />
  );
}




