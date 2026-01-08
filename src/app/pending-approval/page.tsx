'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { GlassCard, EditorialHeadline } from '@/components/ui/glass';

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
              You're on the list.
            </EditorialHeadline>

            {/* Body */}
            <div className="space-y-4 text-stone-600 leading-relaxed">
              <p>
                We're reviewing your application and will be in touch shortly.
              </p>
              <p>
                Folio is invite-only during our founding period—we're building
                something intentional, not another crowded feed.
              </p>
            </div>

            {/* Divider */}
            <div className="w-16 h-px bg-stone-300 mx-auto" />

            {/* Footer */}
            <p className="text-sm text-stone-500">
              Questions? Reach us at{' '}
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
