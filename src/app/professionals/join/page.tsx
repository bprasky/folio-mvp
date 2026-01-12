'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';

/**
 * Legacy /professionals/join route
 * Redirects to the new two-step flow:
 * - If type=designer -> /professionals/designer/organization
 * - If type=vendor -> /professionals/vendor/organization
 * - Otherwise -> /professionals (role selection)
 */
export default function JoinProfessionalsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const type = searchParams.get('type');

    if (type === 'designer') {
      router.replace('/professionals/designer/organization');
    } else if (type === 'vendor') {
      router.replace('/professionals/vendor/organization');
    } else {
      router.replace('/professionals');
    }
  }, [router, searchParams]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#FAF8F5' }}
    >
      <div className="text-center">
        <FaSpinner className="w-8 h-8 animate-spin text-folio-stone-400 mx-auto mb-4" />
        <p className="font-sans text-folio-stone-600">Redirecting...</p>
      </div>
    </div>
  );
}
