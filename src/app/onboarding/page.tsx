'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GlassButton } from '@/components/ui/glass';
import { cn } from '@/lib/utils';

const TOTAL_SCREENS = 2;

// Screen content definitions
const screens = [
  {
    id: 1,
    headline: 'Welcome to Folio.',
    body: (
      <p className="text-stone-600 leading-relaxed text-lg">
        A platform for interior design that connects designers, vendors, and
        design enthusiasts around the work that matters.
      </p>
    ),
    cta: "Let's go",
  },
  {
    id: 2,
    headline: 'Discover. Save. Explore.',
    body: (
      <div className="space-y-4 text-stone-600 leading-relaxed">
        <ul className="space-y-3 text-left">
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Browse projects from top interior designers
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Save products to personal boards
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Follow designers and vendors you love
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 mt-0.5">&#10003;</span>
            <span>
              Get notified about new collections and sales
            </span>
          </li>
        </ul>
      </div>
    ),
    cta: 'Start exploring',
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
      // If already completed onboarding, redirect to magazine
      if (session.user.onboardingCompletedAt) {
        router.replace('/magazine');
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
          // Redirect to magazine to start exploring
          router.replace('/magazine');
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 via-white to-stone-100">
      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {/* Screen content with fade transition */}
          <div
            key={currentScreen}
            className="text-center space-y-8 animate-in fade-in duration-300"
          >
            {/* Headline - Editorial style */}
            <h1 className="font-serif text-4xl md:text-5xl text-stone-900 italic leading-tight">
              {screen.headline}
            </h1>

            {/* Body content */}
            <div className="mx-auto max-w-md">{screen.body}</div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-center gap-4 pt-8">
              {currentScreen > 1 && (
                <GlassButton
                  variant="ghost"
                  size="lg"
                  onClick={handleBack}
                  className="min-w-[100px]"
                >
                  Back
                </GlassButton>
              )}
              <GlassButton
                variant="primary"
                size="lg"
                onClick={handleNext}
                disabled={isCompleting}
                className="min-w-[160px]"
              >
                {isCompleting ? 'Setting up...' : `${screen.cta} \u2192`}
              </GlassButton>
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
                  ? 'w-8 bg-stone-800'
                  : num < currentScreen
                  ? 'bg-stone-400'
                  : 'bg-stone-300'
              )}
            />
          ))}
        </div>
      </div>

      {/* Folio wordmark */}
      <div className="absolute top-6 left-6">
        <span className="text-lg font-semibold text-stone-400">Folio</span>
      </div>
    </div>
  );
}
