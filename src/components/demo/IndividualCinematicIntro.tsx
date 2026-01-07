'use client';

/**
 * Individual Cinematic Intro Wrapper
 * 
 * Shows the Individual intro for demo@folio.com when they first visit as Individual role.
 * Uses localStorage to ensure it only shows once per browser session.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { normalizeRole } from '@/lib/permissions';
import RoleCinematicIntro from './RoleCinematicIntro';
import { INDIVIDUAL_INTRO_SECTIONS } from './introConfig';

const INTRO_SHOWN_KEY = 'folioDemoIndividualIntroShown';

export default function IndividualCinematicIntro() {
  const { data: session } = useSession();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !session?.user) return;

    const userEmail = session.user.email;
    const role = normalizeRole(session.user.role);
    const isDemoIndividual = userEmail === 'demo@folio.com' && (role === 'INDIVIDUAL' || role === 'HOMEOWNER');
    const alreadyShown = localStorage.getItem(INTRO_SHOWN_KEY) === 'true';

    // Show intro if: demo user, Individual role, and not shown before
    if (isDemoIndividual && !alreadyShown) {
      setShowIntro(true);
    }
  }, [session]);

  const handleContinue = () => {
    localStorage.setItem(INTRO_SHOWN_KEY, 'true');
    setShowIntro(false);
    // Tour will auto-start after intro is dismissed
  };

  if (!showIntro) return null;

  return (
    <RoleCinematicIntro
      role="individual"
      sections={INDIVIDUAL_INTRO_SECTIONS}
      onContinue={handleContinue}
      onClose={handleContinue}
    />
  );
}

