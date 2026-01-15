'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RidgeCard } from '@/components/ui/ridge-card';

export default function PendingApprovalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If user is not a designer or is approved, redirect appropriately
    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'DESIGNER') {
        router.replace('/');
        return;
      }
      if (session.user.accountStatus === 'APPROVED') {
        // Check if onboarding is completed
        if (!session.user.onboardingCompletedAt) {
          router.replace('/onboarding');
        } else {
          router.replace('/designer');
        }
        return;
      }
      if (session.user.accountStatus === 'REJECTED') {
        router.replace('/application-rejected');
        return;
      }
    }
  }, [session, status, router]);

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <RidgeCard size="lg" padding="xl">
          <div className="space-y-8">
            {/* Headline */}
            <h1 className="folio-h1 folio-quote">
              You're on the list.
            </h1>

            {/* Body */}
            <div className="space-y-4 folio-body">
              <p>
                We're reviewing your application and will be in touch shortly.
              </p>
              <p>
                Folio is invite-only during our founding period—we're building
                something intentional, not another crowded feed.
              </p>
            </div>

            {/* Divider */}
            <div className="w-16 h-px bg-[var(--ridge-outer)] mx-auto" />

            {/* Footer */}
            <p className="folio-meta">
              Questions? Reach us at{' '}
              <a
                href="mailto:hello@folioad.com"
                className="text-[var(--text-secondary)] underline hover:text-[var(--text-primary)] transition-colors"
              >
                hello@folioad.com
              </a>
            </p>
          </div>
        </RidgeCard>

        {/* Folio logo/wordmark */}
        <div className="mt-8">
          <span className="folio-logo-text text-[var(--text-tertiary)]">Folio</span>
        </div>
      </div>
    </div>
  );
}
