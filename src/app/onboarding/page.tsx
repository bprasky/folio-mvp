'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TOTAL_SCREENS = 5;

// Screen content definitions
const screens = [
  {
    id: 1,
    headline: 'Welcome to Folio.',
    body: (
      <p className="text-stone-600 leading-relaxed text-lg">
        You're joining a small group of designers building something new—a
        professional home for interior design that rewards merit, not marketing
        budgets.
      </p>
    ),
    cta: "Let's go",
  },
  {
    id: 2,
    headline: 'Publish your best work.',
    body: (
      <div className="space-y-4 text-stone-600 leading-relaxed">
        <ul className="space-y-3 text-left">
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Upload project images — we generate editorial-quality layouts that
              rival top design publications, in minutes
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Tag the products you specified — even if the vendor isn't here yet
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Product saves and likes from other designers elevate your work
              naturally—merit, not algorithms
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Build a portfolio that shows your real aesthetic, not just client
              compromises
            </span>
          </li>
        </ul>
        <p className="text-sm text-stone-400 pt-2">
          Instagram sharing is coming soon—one click, Folio attribution built in.
        </p>
      </div>
    ),
    cta: 'Next',
  },
  {
    id: 3,
    headline: "This is just the beginning.",
    body: (
      <div className="space-y-4 text-stone-600 leading-relaxed">
        <ul className="space-y-4 text-left">
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8594;</span>
            <span>
              Your designer fingerprint—Atelier is learning your aesthetic from
              how you work, not what you fill in
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8594;</span>
            <span>
              Vendor attribution—when brands join, they'll see you've been
              specifying their products all along
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8594;</span>
            <span>AI that drafts moodboards in your style</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8594;</span>
            <span>
              Income from influence you already have but never captured
            </span>
          </li>
        </ul>
        <p className="text-sm text-stone-400 pt-2">
          We're building this with you, not for you.
        </p>
      </div>
    ),
    cta: 'Next',
  },
  {
    id: 4,
    headline: "Here's the ask.",
    body: (
      <div className="space-y-4 text-stone-600 leading-relaxed">
        <ul className="space-y-3 text-left">
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8226;</span>
            <span>Publish 1-2 completed projects</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8226;</span>
            <span>
              Share to Instagram with Folio attribution (when it launches)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8226;</span>
            <span>Tell us what's working and what isn't</span>
          </li>
        </ul>
        <p className="text-stone-500 pt-4 italic">
          Your feedback shapes what this becomes.
        </p>
      </div>
    ),
    cta: 'Next',
  },
  {
    id: 5,
    headline: "You're a founding designer.",
    body: (
      <div className="space-y-4 text-stone-600 leading-relaxed">
        <ul className="space-y-3 text-left">
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8226;</span>
            <span>Free premium features during beta and beyond</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8226;</span>
            <span>Direct line to product decisions</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-stone-400">&#8226;</span>
            <span>Recognition that lasts—you helped build this</span>
          </li>
        </ul>
      </div>
    ),
    cta: 'Start creating',
  },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    // Check auth and redirect if needed
    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'DESIGNER') {
        router.replace('/');
        return;
      }
      if (session.user.accountStatus === 'PENDING') {
        router.replace('/pending-approval');
        return;
      }
      if (session.user.accountStatus === 'REJECTED') {
        router.replace('/application-rejected');
        return;
      }
      // If already completed onboarding, redirect to designer dashboard
      if (session.user.onboardingCompletedAt) {
        router.replace('/designer');
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

  const handleNext = async () => {
    if (currentScreen < TOTAL_SCREENS) {
      setCurrentScreen(currentScreen + 1);
    } else {
      // Complete onboarding
      setIsCompleting(true);
      try {
        const response = await fetch('/api/onboarding/complete', {
          method: 'POST',
        });
        if (response.ok) {
          // Redirect to create project page with intent
          router.replace('/designer/create?intent=publish_now&onboard=1');
        } else {
          console.error('Failed to complete onboarding');
          setIsCompleting(false);
        }
      } catch (error) {
        console.error('Error completing onboarding:', error);
        setIsCompleting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentScreen > 1) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  const screen = screens[currentScreen - 1];

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {/* Screen content with fade transition */}
          <div
            key={currentScreen}
            className="text-center space-y-8 animate-in fade-in duration-300"
          >
            {/* Headline - Editorial style */}
            <h1 className="folio-quote text-4xl md:text-5xl">
              {screen.headline}
            </h1>

            {/* Body content */}
            <div className="mx-auto max-w-md folio-body">{screen.body}</div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-center gap-4 pt-8">
              {currentScreen > 1 && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleBack}
                  className="min-w-[100px]"
                >
                  Back
                </Button>
              )}
              <Button
                variant="accent"
                size="lg"
                onClick={handleNext}
                disabled={isCompleting}
                className="min-w-[160px]"
              >
                {isCompleting ? 'Setting up...' : `${screen.cta} \u2192`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress dots - fixed at bottom */}
      <div className="pb-12 flex justify-center">
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_SCREENS }, (_, i) => i + 1).map((num) => (
            <div
              key={num}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                num === currentScreen
                  ? 'w-8 bg-[var(--accent)]'
                  : num < currentScreen
                  ? 'bg-[var(--text-tertiary)]'
                  : 'bg-[var(--ridge-outer)]'
              )}
            />
          ))}
        </div>
      </div>

      {/* Folio wordmark */}
      <div className="absolute top-6 left-6">
        <span className="folio-logo-text text-folio-text-tertiary">Folio</span>
      </div>
    </div>
  );
}
