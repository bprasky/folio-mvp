'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ImpersonationData {
  isImpersonating: boolean;
  originalAdminId?: string;
  originalAdminEmail?: string;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  startedAt?: string;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Check impersonation status on mount
    async function checkImpersonation() {
      try {
        const response = await fetch('/api/admin/impersonate/exit');
        if (response.ok) {
          const data = await response.json();
          if (data.isImpersonating) {
            setImpersonationData(data);
          }
        }
      } catch (error) {
        console.error('Error checking impersonation status:', error);
      }
    }

    checkImpersonation();
  }, []);

  const handleExitImpersonation = async () => {
    setIsExiting(true);
    try {
      const response = await fetch('/api/admin/impersonate/exit', {
        method: 'POST',
      });
      if (response.ok) {
        // Clear local state and redirect to admin users page
        setImpersonationData(null);
        router.push('/admin/users');
        router.refresh();
      }
    } catch (error) {
      console.error('Error exiting impersonation:', error);
    } finally {
      setIsExiting(false);
    }
  };

  // Don't render if not impersonating
  if (!impersonationData?.isImpersonating) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-900 px-4 py-2 flex items-center justify-center gap-4 shadow-md"
      style={{ zIndex: 9999 }}
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span className="font-medium">
          You are viewing as{' '}
          <strong>{impersonationData.targetUserName}</strong>{' '}
          <span className="opacity-75">({impersonationData.targetUserEmail})</span>
        </span>
      </div>
      <button
        onClick={handleExitImpersonation}
        disabled={isExiting}
        className="px-4 py-1 bg-amber-900 text-amber-100 rounded-full text-sm font-medium hover:bg-amber-800 transition-colors disabled:opacity-50"
      >
        {isExiting ? 'Exiting...' : 'Exit Impersonation'}
      </button>
    </div>
  );
}
