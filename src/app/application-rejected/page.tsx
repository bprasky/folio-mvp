'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RidgeCard } from '@/components/ui/ridge-card';

export default function ApplicationRejectedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch rejection reason if user is rejected
    async function fetchRejectionReason() {
      try {
        const response = await fetch('/api/auth/rejection-reason');
        if (response.ok) {
          const data = await response.json();
          setRejectionReason(data.rejectionReason);
        }
      } catch (error) {
        console.error('Error fetching rejection reason:', error);
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'DESIGNER') {
        router.replace('/');
        return;
      }
      if (session.user.accountStatus === 'APPROVED') {
        if (!session.user.onboardingCompletedAt) {
          router.replace('/onboarding');
        } else {
          router.replace('/designer');
        }
        return;
      }
      if (session.user.accountStatus === 'PENDING') {
        router.replace('/pending-approval');
        return;
      }
      // User is rejected, fetch the reason
      fetchRejectionReason();
    }
  }, [session, status, router]);

  // Show loading while checking auth
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="folio-body">Loading...</div>
      </div>
    );
  }

  // If not authenticated, redirect to signin
  if (status === 'unauthenticated') {
    router.replace('/auth/signin');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <RidgeCard size="lg" padding="xl">
          <div className="space-y-8">
            {/* Headline */}
            <h1 className="folio-h2">
              Application Status
            </h1>

            {/* Body */}
            <div className="space-y-4 folio-body">
              <p>
                Thanks for your interest in Folio. After reviewing your
                application, we're not able to approve your account at this time.
              </p>

              {/* Rejection reason if provided */}
              {rejectionReason && (
                <div className="mt-6 ridge-card ridge-card-sm p-4 bg-surface-ground">
                  <p className="folio-meta mb-2">Note from our team:</p>
                  <p className="folio-quote text-base">{rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-16 h-px bg-[var(--ridge-outer)] mx-auto" />

            {/* Footer */}
            <p className="folio-meta leading-relaxed">
              This isn't permanent—we're in an early, intentional phase and may
              expand access soon. Feel free to reach out at{' '}
              <a
                href="mailto:hello@folioad.com"
                className="text-folio-text-secondary underline hover:text-folio-text-primary transition-colors"
              >
                hello@folioad.com
              </a>
            </p>
          </div>
        </RidgeCard>

        {/* Folio logo/wordmark */}
        <div className="mt-8">
          <span className="folio-logo-text text-folio-text-tertiary">Folio</span>
        </div>
      </div>
    </div>
  );
}
