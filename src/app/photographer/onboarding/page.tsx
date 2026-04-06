'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PHOTOGRAPHY_STYLE_OPTIONS = [
  'Interior',
  'Architectural',
  'Lifestyle',
  'Portrait',
  'Commercial',
  'Editorial',
];

const TOTAL_SCREENS = 3;

export default function PhotographerOnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentScreen, setCurrentScreen] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [form, setForm] = useState({
    location: '',
    photographyStyles: [] as string[],
    travelRadius: '',
    bio: '',
    bookingUrl: '',
    bookingEmail: '',
    website: '',
    instagram: '',
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-folio-text-tertiary">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.replace('/auth/signin');
    return null;
  }

  function toggleStyle(style: string) {
    setForm((prev) => ({
      ...prev,
      photographyStyles: prev.photographyStyles.includes(style)
        ? prev.photographyStyles.filter((s) => s !== style)
        : [...prev.photographyStyles, style],
    }));
  }

  async function handleComplete() {
    setIsCompleting(true);
    try {
      // Save profile data
      await fetch('/api/photographer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      // Mark onboarding complete
      await fetch('/api/onboarding/complete', { method: 'POST' });

      router.replace('/photographer/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsCompleting(false);
    }
  }

  const handleNext = () => {
    if (currentScreen < TOTAL_SCREENS) {
      setCurrentScreen(currentScreen + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentScreen > 1) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas">
      {/* Folio wordmark */}
      <div className="absolute top-6 left-6">
        <span className="folio-logo-text text-folio-text-tertiary">Folio</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <div key={currentScreen} className="text-center space-y-8 animate-in fade-in duration-300">
            {currentScreen === 1 && (
              <>
                <h1 className="folio-quote text-4xl md:text-5xl">
                  Welcome to Folio.
                </h1>
                <div className="mx-auto max-w-md folio-body text-stone-600 space-y-4">
                  <p>
                    Your portfolio builds itself. Every time a designer credits your work
                    on a published project, it appears on your Folio profile automatically.
                  </p>
                  <ul className="space-y-3 text-left">
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 mt-0.5">&#10003;</span>
                      <span>Automatic portfolio from credited projects</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 mt-0.5">&#10003;</span>
                      <span>"Hire Me" button connects you with designers who need photography</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-600 mt-0.5">&#10003;</span>
                      <span>Free during the founding phase</span>
                    </li>
                  </ul>
                </div>
              </>
            )}

            {currentScreen === 2 && (
              <>
                <h1 className="folio-quote text-3xl md:text-4xl">
                  Set up your profile.
                </h1>
                <div className="mx-auto max-w-md text-left space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
                      Location
                    </label>
                    <Input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="Orlando, FL"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-2">
                      Photography Styles
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PHOTOGRAPHY_STYLE_OPTIONS.map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => toggleStyle(style.toLowerCase())}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                            form.photographyStyles.includes(style.toLowerCase())
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-white text-folio-text-secondary border-folio-border-subtle hover:border-[var(--accent)]'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
                      Travel Radius
                    </label>
                    <Input
                      value={form.travelRadius}
                      onChange={(e) => setForm({ ...form, travelRadius: e.target.value })}
                      placeholder="Southeast US, Nationwide, etc."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
                      About
                    </label>
                    <textarea
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Brief description of your work and style..."
                      rows={3}
                      className="w-full rounded-lg border border-folio-border-subtle bg-white px-3 py-2 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                    />
                  </div>
                </div>
              </>
            )}

            {currentScreen === 3 && (
              <>
                <h1 className="folio-quote text-3xl md:text-4xl">
                  How can designers reach you?
                </h1>
                <div className="mx-auto max-w-md text-left space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
                      Booking URL
                    </label>
                    <Input
                      type="url"
                      value={form.bookingUrl}
                      onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })}
                      placeholder="https://calendly.com/your-link"
                    />
                    <p className="text-xs text-folio-text-tertiary mt-1">
                      Calendly, HoneyBook, or other booking page
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
                      Booking Email
                    </label>
                    <Input
                      type="email"
                      value={form.bookingEmail}
                      onChange={(e) => setForm({ ...form, bookingEmail: e.target.value })}
                      placeholder="bookings@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
                      Website
                    </label>
                    <Input
                      type="url"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://yoursite.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-folio-text-primary mb-1.5">
                      Instagram
                    </label>
                    <Input
                      value={form.instagram}
                      onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                      placeholder="yourhandle"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 pt-8">
              {currentScreen > 1 && (
                <Button variant="ghost" size="lg" onClick={handleBack} className="min-w-[100px]">
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
                {isCompleting
                  ? 'Setting up...'
                  : currentScreen === TOTAL_SCREENS
                  ? 'Complete setup \u2192'
                  : 'Next \u2192'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress dots */}
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
    </div>
  );
}
