'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  ForDesignersHero,
  HowItWorks,
  WhatYouGet,
  FoundingCohort,
} from '@/app/for-designers/sections';
import { WelcomeModal } from '@/components/marketing/WelcomeModal';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [showModal, setShowModal] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('folio_welcome_dismissed');
  });

  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace('/magazine');
    }
  }, [status, session, router]);

  // While checking auth, show landing content (correct for both cases:
  // unauthenticated users see it, authenticated users see it briefly before redirect)
  return (
    <>
      <ForDesignersHero />
      <HowItWorks />
      <WhatYouGet />
      <FoundingCohort />
      {showModal && status !== 'authenticated' && (
        <WelcomeModal
          onDismiss={() => {
            sessionStorage.setItem('folio_welcome_dismissed', 'true');
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
