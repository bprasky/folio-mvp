'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GlassCard, EditorialHeadline } from '@/components/ui/glass';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-stone-100">
        <div className="text-stone-500">Loading...</div>
      </div>
    );
  }

  // If not authenticated, redirect to signin
  if (status === 'unauthenticated') {
    router.replace('/auth/signin');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-stone-100 px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <GlassCard variant="strong" padding="xl" rounded="3xl">
          <div className="space-y-8">
            {/* Headline */}
            <EditorialHeadline size="xl" className="text-stone-900">
              Application Status
            </EditorialHeadline>

            {/* Body */}
            <div className="space-y-4 text-stone-600 leading-relaxed">
              <p>
                Thanks for your interest in Folio. After reviewing your
                application, we're not able to approve your account at this time.
              </p>

              {/* Rejection reason if provided */}
              {rejectionReason && (
                <div className="mt-6 p-4 bg-stone-100/80 rounded-xl border border-stone-200/50">
                  <p className="text-sm text-stone-500 mb-2">Note from our team:</p>
                  <p className="text-stone-700 italic">{rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-16 h-px bg-stone-300 mx-auto" />

            {/* Footer */}
            <p className="text-sm text-stone-500 leading-relaxed">
              This isn't permanent—we're in an early, intentional phase and may
              expand access soon. Feel free to reach out at{' '}
              <a
                href="mailto:hello@folioad.com"
                className="text-stone-700 underline hover:text-stone-900 transition-colors"
              >
                hello@folioad.com
              </a>
            </p>
          </div>
        </GlassCard>

        {/* Folio logo/wordmark */}
        <div className="mt-8">
          <span className="text-lg font-semibold text-stone-400">Folio</span>
        </div>
      </div>
    </div>
  );
}
