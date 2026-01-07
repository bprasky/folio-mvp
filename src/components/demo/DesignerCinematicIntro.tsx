'use client';

/**
 * Designer Cinematic Intro Wrapper
 * 
 * Shows the Designer intro for demo@folio.com when they first visit as Designer role.
 * Uses localStorage to ensure it only shows once per browser session.
 * 
 * This reuses the existing designer intro sections but works for demo@folio.com,
 * while the existing DemoModeContext system remains for demodesigner@folio.com.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { normalizeRole } from '@/lib/permissions';
import RoleCinematicIntro from './RoleCinematicIntro';
import { DESIGNER_INTRO_SECTIONS } from './introConfig';

const INTRO_SHOWN_KEY = 'folioDemoDesignerIntroShown';

export default function DesignerCinematicIntro() {
  const { data: session } = useSession();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !session?.user) return;

    const userEmail = session.user.email;
    const role = normalizeRole(session.user.role);
    const isDemoDesigner = userEmail === 'demo@folio.com' && role === 'DESIGNER';
    const alreadyShown = localStorage.getItem(INTRO_SHOWN_KEY) === 'true';

    // Show intro if: demo user, Designer role, and not shown before
    // Note: This is separate from the existing demodesigner@folio.com demo system
    if (isDemoDesigner && !alreadyShown) {
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
      role="designer"
      sections={DESIGNER_INTRO_SECTIONS}
      onContinue={handleContinue}
      onClose={handleContinue}
    />
  );
}




