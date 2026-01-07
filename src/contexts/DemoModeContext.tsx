'use client';

/**
 * Demo Mode Context
 * 
 * Provides Designer Demo Mode functionality for guided tours.
 * 
 * This context is specifically for the Designer Demo audience (demodesigner@folio.com).
 * Future audiences (Vendor, Events) can be added by extending the audience type
 * and creating separate step configurations.
 * 
 * Demo Mode is:
 * - Gated by user email (only demodesigner@folio.com)
 * - Client-side only (uses localStorage for completion tracking)
 * - Non-destructive (does not modify database or existing routes)
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { isDesignerDemoUser } from '@/lib/demo/isDesignerDemoUser';

export type DemoAudience = 'designer' | 'vendor' | 'events';

export type DemoStepType =
  | 'fullscreen_intro'
  | 'feed_overlay'
  | 'project_overlay'
  | 'events_overlay'
  | 'future_overlay';

export interface DemoStep {
  id: string;
  type: DemoStepType;
  route?: string;              // e.g. '/', '/feed', '/projects/[id]', '/events'
  title?: string;
  body?: string;
  body2?: string;              // Optional second paragraph
  ctaLabel?: string;
  highlightSelector?: string;  // CSS selector or data attribute
  autoScroll?: boolean;
}

interface DemoModeState {
  enabled: boolean;          // True only for demo accounts
  audience: DemoAudience | null;    // For now always 'designer'
  active: boolean;           // True when the guided tour is running
  currentStepIndex: number;
  steps: DemoStep[];
  freeExplore: boolean;      // True when user has opted for free explore
}

interface DemoModeContextType extends DemoModeState {
  startDemo: () => void;
  endDemo: () => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (index: number) => void;
  enableFreeExplore: () => void;
  currentStep: DemoStep | null;
  isFirstStep: boolean;
  isLastStep: boolean;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

const DEMO_COMPLETED_KEY = 'folioDesignerDemoCompleted';
const DEMO_FREE_EXPLORE_KEY = 'folioDesignerDemoFreeExplore';

// Designer Demo Steps Configuration
// TODO: Move to separate config file when adding Vendor/Events demos
const DESIGNER_DEMO_STEPS: DemoStep[] = [
  {
    id: 'intro-1',
    type: 'fullscreen_intro',
    title: 'The design industry is backwards.',
    body: 'Designers and architects are some of the most talented creatives in the world — yet too many still fight for exposure, pay for recognition, and battle ad-driven publications for a chance to be seen.',
    body2: 'The moment a contract is signed, your value begins to decay. Hours run over. Extra meetings dilute profit. Reselections stall progress and hold the next payout hostage. When the project is finally finished, your work is posted to feeds designed to disappear — built on algorithms meant to bury what deserves to live.',
    ctaLabel: 'Next',
  },
  {
    id: 'intro-2',
    type: 'fullscreen_intro',
    title: 'Creators deserve better.',
    body: 'A place where your work lives as long as you want it to.',
    body2: 'A place where your talent earns for you.\n\nA place that builds value instead of draining it.\n\nA place where your portfolio works for you, every hour of every day.\n\nThis is Folio.',
    ctaLabel: 'Begin the Tour',
    route: '/feed',
  },
  {
    id: 'feed',
    type: 'feed_overlay',
    route: '/feed',
    title: 'Design, shown as it was intended.',
    body: 'This is Folio\'s Inspire feed — where design is shown as it was intended.',
    body2: 'Not compressed into thumbnails. Not swallowed by algorithms.\n\nBut treated like editorial.\n\nEvery post is a digital magazine — a full story, a complete vision.\n\nWritten in your words, elevated by Folio\'s AI editorial engine.',
    ctaLabel: 'View a project',
    highlightSelector: '[data-demo-id="feed-list"]',
    autoScroll: true,
  },
  {
    id: 'project',
    type: 'project_overlay',
    route: '/p/meru-XB4XBK', // Hardcoded demo project
    title: 'Projects as living hubs for your work.',
    body: 'Projects become living, breathing hubs for your work.',
    body2: 'Everything you already create — the photos, the materials, the behind-the-scenes moments, the final reveal — now lives together as a complete digital publication.\n\nTag vendors and products to earn affiliate commissions.\n\nUse our AI editorial engine to generate compelling articles — ready to share, ready for others to save and like, and even ready to send to print for your business.',
    ctaLabel: 'Show me events',
    highlightSelector: '[data-demo-id="project-article"]',
  },
  {
    id: 'events',
    type: 'events_overlay',
    route: '/events',
    title: 'Events become part of your workflow.',
    body: 'When you attend events, your photos and discoveries don\'t have to disappear into your camera roll.',
    body2: 'Save images, products, and moments directly into a project file — before, during, or after the event. Vendors can easily follow up, and you can generate spec sheets on command because everything lives in the same place.\n\nOver time, Folio will even generate room scenes based on the products you saved — turning events into real, buildable concepts.',
    ctaLabel: 'What happens next?',
    highlightSelector: '[data-demo-id="events-list"]',
  },
  {
    id: 'future',
    type: 'future_overlay',
    route: '/feed', // Or profile, depending on design
    title: 'Folio learns your Design Fingerprint.',
    body: 'As you work, Folio learns your taste. Your selections, your style, your editorial voice — all become part of your Design Fingerprint.',
    body2: 'Over time, Folio becomes your silent partner — connecting you with perfect-fit products, ideal clients, and inspiration curated around your vision.\n\nOne day, Folio will not only organize your workflow — it will assist your clients in your voice, send selections that match your style, and help your talent scale far beyond your hours.\n\nFolio was built so you can be the face of your business, while AI becomes the team behind you.',
    ctaLabel: 'Finish Demo',
  },
];

interface DemoModeProviderProps {
  children: ReactNode;
}

export function DemoModeProvider({ children }: DemoModeProviderProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [freeExplore, setFreeExplore] = useState(false);

  // Determine if demo mode should be enabled
  const userEmail = session?.user?.email;
  const enabled = status !== 'loading' && isDesignerDemoUser(userEmail);
  const audience: DemoAudience | null = enabled ? 'designer' : null;

  // Initialize steps (project route is hardcoded to /p/meru-XB4XBK)
  const [steps] = useState<DemoStep[]>(() => {
    return [...DESIGNER_DEMO_STEPS];
  });

  // Check localStorage for completion state
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    const completed = localStorage.getItem(DEMO_COMPLETED_KEY) === 'true';
    const freeExploreMode = localStorage.getItem(DEMO_FREE_EXPLORE_KEY) === 'true';

    if (freeExploreMode) {
      setFreeExplore(true);
      setActive(false);
    } else if (!completed && enabled) {
      // Auto-start demo on first visit
      setActive(true);
      setCurrentStepIndex(0);
    }
  }, [enabled]);

  // Project route is now hardcoded to /p/meru-XB4XBK, no need to fetch

  // Navigate to step route when step changes (only if active)
  useEffect(() => {
    if (!active || !enabled) return;

    const step = steps[currentStepIndex];
    if (!step?.route) return;

    // Skip navigation for intro steps (they don't have routes initially)
    if (step.type === 'fullscreen_intro') {
      // For intro-2, navigate to feed when it becomes active
      if (step.id === 'intro-2' && currentStepIndex === 1 && pathname !== '/feed') {
        // Delay navigation slightly to allow overlay to render first
        setTimeout(() => {
          router.push('/feed');
        }, 100);
      }
      return;
    }

    // For overlay steps, navigate if we're not already on the route
    const currentRoute = pathname?.split('?')[0]; // Remove query params
    const stepRoute = step.route?.split('?')[0];

    // Only navigate if we're on a different route
    if (stepRoute && currentRoute !== stepRoute) {
      router.push(step.route);
    }
  }, [currentStepIndex, active, enabled, steps, router, pathname]);

  const startDemo = useCallback(() => {
    if (!enabled) return;
    setActive(true);
    setCurrentStepIndex(0);
    setFreeExplore(false);
    localStorage.removeItem(DEMO_COMPLETED_KEY);
    localStorage.removeItem(DEMO_FREE_EXPLORE_KEY);
    // Navigate to first step route (or stay on current page for intro)
    const firstStep = steps[0];
    if (firstStep?.route && firstStep.type !== 'fullscreen_intro') {
      router.push(firstStep.route);
    }
  }, [enabled, steps, router]);

  const endDemo = useCallback(() => {
    setActive(false);
    localStorage.setItem(DEMO_COMPLETED_KEY, 'true');
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      
      // Special handling for intro-2: mark as active tour when moving to feed
      const nextStep = steps[newIndex];
      if (nextStep?.id === 'feed') {
        // Already handled by route effect
      }
    } else {
      // Last step - finish demo
      endDemo();
    }
  }, [currentStepIndex, steps, endDemo]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  }, [steps.length]);

  const currentStep = steps[currentStepIndex] || null;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Handle free explore mode
  const enableFreeExplore = useCallback(() => {
    setFreeExplore(true);
    setActive(false);
    localStorage.setItem(DEMO_FREE_EXPLORE_KEY, 'true');
    localStorage.setItem(DEMO_COMPLETED_KEY, 'true');
  }, []);

  const value: DemoModeContextType = {
    enabled,
    audience,
    active,
    currentStepIndex,
    steps,
    freeExplore,
    startDemo,
    endDemo,
    nextStep,
    previousStep,
    goToStep,
    enableFreeExplore,
    currentStep,
    isFirstStep,
    isLastStep,
  };

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    // Return a no-op context for non-demo users
    return {
      enabled: false,
      audience: null,
      active: false,
      currentStepIndex: 0,
      steps: [],
      freeExplore: false,
      startDemo: () => {},
      endDemo: () => {},
      nextStep: () => {},
      previousStep: () => {},
      goToStep: () => {},
      enableFreeExplore: () => {},
      currentStep: null,
      isFirstStep: true,
      isLastStep: true,
    } as DemoModeContextType;
  }
  return context;
}

