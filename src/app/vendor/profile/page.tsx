'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../../../contexts/RoleContext';

export default function VendorProfileRedirect() {
  const router = useRouter();
  const { activeProfileId } = useRole();

  useEffect(() => {
    // If we have an active profile ID, redirect to the dynamic vendor profile
    if (activeProfileId) {
      router.push(`/vendor/${activeProfileId}`);
    } else {
      // If no active profile, redirect to vendor dashboard
      router.push('/vendor');
    }
  }, [activeProfileId, router]);

  return (
    <div className="flex min-h-screen bg-folio-background items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-folio-accent mx-auto mb-4"></div>
        <p className="text-folio-text">Loading your profile...</p>
      </div>
    </div>
  );
} 