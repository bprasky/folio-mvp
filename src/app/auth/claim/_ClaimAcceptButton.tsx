'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  token: string;
  orgName: string;
};

export function ClaimAcceptButton({ token, orgName }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleClaim = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not claim the organization.');
        setSubmitting(false);
        return;
      }
      setMessage(`Welcome to ${orgName}. Taking you to onboarding…`);
      setTimeout(() => {
        router.replace('/onboarding/diagnostic');
        router.refresh();
      }, 1200);
    } catch {
      setError('Could not claim the organization. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <>
      {error ? (
        <div className="auth-message auth-message--error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="auth-message auth-message--success" role="status">
          {message}
        </div>
      ) : null}
      <button
        type="button"
        className="auth-submit"
        onClick={handleClaim}
        disabled={submitting || !!message}
      >
        {submitting ? 'Claiming…' : `Claim ${orgName}`}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </button>
    </>
  );
}
