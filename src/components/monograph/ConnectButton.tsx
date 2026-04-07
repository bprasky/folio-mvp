'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ConnectButtonProps {
  recipientUserId: string;
  recipientName: string;
  /** ISO date string if already connected recently */
  existingVisitDate?: string | null;
  existingVisitId?: string | null;
}

export default function ConnectButton({
  recipientUserId,
  recipientName,
  existingVisitDate,
  existingVisitId,
}: ConnectButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [visitId, setVisitId] = useState<string | null>(existingVisitId || null);
  const [territoryWarning, setTerritoryWarning] = useState<string | null>(null);

  // Don't show if session is loading or user is the profile owner
  if (status === 'loading') return null;
  if (session?.user?.id === recipientUserId) return null;

  // Already connected
  if (existingVisitDate || state === 'success') {
    const date = existingVisitDate
      ? new Date(existingVisitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'just now';

    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          onClick={() => visitId && router.push(`/visits/${visitId}`)}
          className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded border border-folio-border-subtle/50 shadow-sm hover:bg-surface-canvas transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-folio-text-secondary">Connected {date}</span>
        </button>
        {territoryWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 max-w-xs">
            <p className="text-xs text-amber-700">{territoryWarning}</p>
          </div>
        )}
      </div>
    );
  }

  async function handleConnect() {
    if (!session?.user?.id) {
      // Redirect to sign in with callback
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setState('loading');

    try {
      const res = await fetch('/api/visits/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientUserId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[ConnectButton] Error:', data.error);
        setState('error');
        return;
      }

      const data = await res.json();
      setVisitId(data.visit.id);
      setState('success');

      // Show territory warning if present
      if (data.territoryWarning?.message) {
        setTerritoryWarning(data.territoryWarning.message);
      }

      // Navigate to visit detail after brief pause
      setTimeout(() => {
        router.push(`/visits/${data.visit.id}`);
      }, territoryWarning ? 3000 : 1000);
    } catch (err) {
      console.error('[ConnectButton] Network error:', err);
      setState('error');
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={state === 'loading'}
      className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-4 py-2 rounded border border-folio-border-subtle/50 shadow-sm hover:bg-surface-canvas transition-colors disabled:opacity-50 cursor-pointer"
    >
      {state === 'loading' ? (
        <>
          <svg className="w-4 h-4 animate-spin text-folio-text-tertiary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-folio-text-tertiary">Connecting...</span>
        </>
      ) : state === 'error' ? (
        <>
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-sm text-red-600">Failed — try again</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 text-folio-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-sm text-folio-text-secondary">Connect with {recipientName.split(' ')[0]}</span>
        </>
      )}
    </button>
  );
}
