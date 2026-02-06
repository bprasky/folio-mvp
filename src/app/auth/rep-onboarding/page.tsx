'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';

export default function RepOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  
  const inviteId = searchParams.get('inviteId');
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [emailChoice, setEmailChoice] = useState<'same' | 'different' | null>(null);
  const [workEmail, setWorkEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!inviteId || !token) {
      setError('Invalid invite link. Missing invite ID or token.');
      setLoading(false);
      return;
    }

    // Validate invite
    fetch(`/api/auth/rep-onboarding/validate?inviteId=${inviteId}&token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInviteData(data.invite);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to validate invite');
        setLoading(false);
      });
  }, [inviteId, token]);

  // If not authenticated, show signup/signin prompt
  if (status === 'unauthenticated' && !loading && !error && inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-elevated)] px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold mb-4">Join Folio as a Vendor Rep</h1>
          <p className="text-gray-600 mb-6">
            You've been invited to join Folio. Please sign in or create an account to continue.
          </p>
          <div className="space-y-4">
            <Link
              href={`/auth/signin?callbackUrl=/auth/rep-onboarding?inviteId=${inviteId}&token=${token}`}
              className="block w-full text-center bg-[var(--accent)] text-white py-2 px-4 rounded hover:bg-[var(--accent-hover)]"
            >
              Sign In
            </Link>
            <Link
              href={`/auth/signup?callbackUrl=/auth/rep-onboarding?inviteId=${inviteId}&token=${token}`}
              className="block w-full text-center bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, show email choice screen
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailChoice || (emailChoice === 'different' && !workEmail.trim())) {
      setError('Please complete all fields');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/rep-onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId,
          token,
          emailChoice,
          workEmail: emailChoice === 'different' ? workEmail.trim() : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to complete onboarding');
        setSubmitting(false);
        return;
      }

      // Success - redirect to rep dashboard
      router.push('/vendor/rep/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-elevated)] px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Invalid Invite</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="block w-full text-center bg-[var(--accent)] text-white py-2 px-4 rounded hover:bg-[var(--accent-hover)]"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return null; // Will show signin prompt above
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-elevated)] px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-4">Set Up Your Rep Profile</h1>
        <p className="text-gray-600 mb-6">
          You were invited using <strong>{inviteData?.email}</strong>. This might be your personal email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Choose your professional email for work notifications:
            </p>
            
            <div className="space-y-3">
              <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-[var(--bg-elevated)]">
                <input
                  type="radio"
                  name="emailChoice"
                  value="same"
                  checked={emailChoice === 'same'}
                  onChange={() => setEmailChoice('same')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">Use this email as my work email</div>
                  <div className="text-sm text-gray-500">{inviteData?.email}</div>
                </div>
              </label>

              <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-[var(--bg-elevated)]">
                <input
                  type="radio"
                  name="emailChoice"
                  value="different"
                  checked={emailChoice === 'different'}
                  onChange={() => setEmailChoice('different')}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium">Use a different professional email</div>
                  {emailChoice === 'different' && (
                    <input
                      type="email"
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="work@company.com"
                      className="mt-2 w-full px-3 py-2 border rounded-md"
                      required
                    />
                  )}
                </div>
              </label>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !emailChoice}
            className="w-full bg-[var(--accent)] text-white py-2 px-4 rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-500 text-center">
          Once set up, you'll automatically follow designers who have tagged your organization.
        </p>
      </div>
    </div>
  );
}




