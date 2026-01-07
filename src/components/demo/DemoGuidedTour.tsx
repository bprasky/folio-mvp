'use client';

/**
 * Demo Guided Tour Component
 * 
 * Provides step-by-step guidance after the cinematic intro for demo@folio.com.
 * Shows tooltips and highlights to guide users through the demo flow.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeRole } from '@/lib/permissions';

export type TourStep = {
  id: string;
  route: string; // Route where this step should appear (use /* for dynamic routes)
  title: string;
  body: string;
  highlightSelector?: string; // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // Tooltip position
  actionHint?: string; // What action to take (e.g., "Click the 'Hire' button")
  skipable?: boolean;
  waitForClick?: boolean; // If true, wait for click on highlighted element before enabling Next
};

// Individual demo tour steps
const INDIVIDUAL_TOUR_STEPS: TourStep[] = [
  {
    id: 'individual-1-open-top-project',
    route: '/feed',
    title: 'Open Your First Project',
    body: 'This is your inspiration feed. For the demo, start by opening the featured project at the top — it\'s a real space made of real, shoppable products.',
    highlightSelector: '[data-demo-id="feed-top-project"]',
    position: 'top',
    actionHint: 'Click this top project to open it.',
    skipable: true,
    waitForClick: true,
  },
  {
    id: 'individual-2',
    route: '/feed',
    title: 'Save What You Like',
    body: 'Click the bookmark icon on any project or product to save it to your collection. You can save items directly from the feed.',
    highlightSelector: '[data-demo-id="save-button"], button[aria-label*="Save"], button[aria-label*="Bookmark"]',
    position: 'bottom',
    actionHint: 'Try saving an item by clicking the bookmark icon',
    skipable: true,
    waitForClick: true,
  },
  {
    id: 'individual-3',
    route: '/individual',
    title: 'Review Your Saved Items',
    body: 'All your saved items are organized here. You can create folders to organize by room or project.',
    highlightSelector: '[data-demo-id="saved-items"], .saved-items-container, [class*="saved"]',
    position: 'top',
    actionHint: 'Navigate to see your saved items (or click "Saved Items" in the navigation)',
    skipable: true,
  },
  {
    id: 'individual-4',
    route: '/individual/hire',
    title: 'Hire a Designer',
    body: 'When you\'re ready, use this flow to find and hire a designer who matches your style and budget.',
    highlightSelector: '[data-demo-id="hire-button"], button[aria-label*="Hire"], a[href*="hire"]',
    position: 'bottom',
    actionHint: 'Click "Hire" to create a project with your saved items',
    skipable: true,
    waitForClick: true,
  },
  {
    id: 'individual-5',
    route: '/feed',
    title: 'Switch to Designer View',
    body: 'Now let\'s see how this looks from the designer side. Use the role switcher at the top of the page to switch to Designer role.',
    highlightSelector: '[data-demo-id="demo-role-switcher"]',
    position: 'bottom',
    actionHint: 'Click "Designer" in the role switcher',
    skipable: true,
  },
];

// Designer demo tour steps
const DESIGNER_TOUR_STEPS: TourStep[] = [
  {
    id: 'designer-1',
    route: '/designer',
    title: 'Your Designer Dashboard',
    body: 'This is your project hub. Here you can see all projects you\'re working on.',
    highlightSelector: '[data-demo-id="designer-projects"]',
    position: 'top',
    actionHint: 'Browse your projects',
  },
  {
    id: 'designer-2',
    route: '/project/*',
    title: 'Open a Project',
    body: 'Click on any project to open it. You\'ll see all the selections the client saved, organized by room.',
    highlightSelector: '[data-demo-id="project-link"]',
    position: 'bottom',
    actionHint: 'Click to open a project',
  },
  {
    id: 'designer-3',
    route: '/project/*',
    title: 'Designer Board',
    body: 'This is your designer board. You can see all selections organized by room, and use AI to generate concept images.',
    highlightSelector: '[data-demo-id="designer-board"]',
    position: 'top',
    actionHint: 'Explore the selections',
  },
  {
    id: 'designer-4',
    route: '/project/*',
    title: 'Generate Images with AI',
    body: 'Click "Generate Images" to create AI-powered concept images for your project rooms. First, select a room from the dropdown.',
    highlightSelector: '[data-demo-id="generate-images-button"], button[aria-label*="Generate"]',
    position: 'right',
    actionHint: 'Select a room, then click "Generate Images"',
    waitForClick: true,
  },
  {
    id: 'designer-5',
    route: '/project/*',
    title: 'Draft an Editorial',
    body: 'Once you have images and selections, you can draft an editorial that will appear in the feed.',
    highlightSelector: 'button[aria-label*="Draft Editorial"]',
    position: 'top',
    actionHint: 'Click "Draft Editorial"',
    waitForClick: true,
  },
  {
    id: 'designer-6',
    route: '/designer',
    title: 'Switch to Vendor View',
    body: 'Now let\'s see how vendors experience the same data. Switch to Vendor role using the role switcher.',
    highlightSelector: '[data-demo-id="demo-role-switcher"]',
    position: 'bottom',
    actionHint: 'Click "Vendor" in the role switcher',
    skipable: true,
  },
];

// Designer/Individual Events tour steps (shared)
const EVENTS_TOUR_STEPS: TourStep[] = [
  {
    id: 'events-list',
    route: '/events',
    title: 'Events on Folio',
    body: 'Here you can discover vendor events, see who is exhibiting, and explore featured products.',
    highlightSelector: '[data-demo-id="events-list"]',
    position: 'top',
    actionHint: 'Browse upcoming events',
    skipable: true,
  },
  {
    id: 'event-rsvp',
    route: '/events/*',
    title: 'RSVP to Events',
    body: 'RSVPing through Folio connects this event to your profile and projects, so your engagement is tracked automatically.',
    highlightSelector: '[data-demo-id="rsvp-control"]',
    position: 'right',
    actionHint: 'Click RSVP to register for the event',
    skipable: true,
  },
  {
    id: 'event-save-product',
    route: '/events/*',
    title: 'Save Products from Events',
    body: 'When you find a material or product you like at an event, you can save it directly into your projects from here.',
    highlightSelector: '[data-demo-id="event-product-save"]',
    position: 'bottom',
    actionHint: 'Click the bookmark icon to save products',
    skipable: true,
  },
];

// Vendor demo tour steps
const VENDOR_TOUR_STEPS: TourStep[] = [
  {
    id: 'vendor-1',
    route: '/vendor/dashboard',
    title: 'Vendor Analytics Dashboard',
    body: 'This is your analytics hub. Here you can see engagement metrics, product saves, and designer activity.',
    highlightSelector: '[data-demo-id="vendor-analytics"]',
    position: 'top',
    actionHint: 'Explore the analytics',
  },
  {
    id: 'vendor-2',
    route: '/vendor/dashboard',
    title: 'Your Events',
    body: 'Events are integrated into your dashboard. Here you can track RSVPs, engagement, and product saves from each event.',
    highlightSelector: '[data-demo-id="vendor-events"], [data-demo-id="vendor-analytics"]',
    position: 'top',
    actionHint: 'Explore event insights in your dashboard',
  },
  {
    id: 'vendor-3',
    route: '/vendor/my-events/*',
    title: 'Event Analytics',
    body: 'Click on any event to see detailed analytics: which designers RSVPed, what products were saved, and engagement metrics.',
    highlightSelector: '[data-demo-id="event-link"]',
    position: 'bottom',
    actionHint: 'Navigate to event details from the dashboard',
  },
  {
    id: 'vendor-4',
    route: '/vendor/dashboard',
    title: 'Digital Showrooms',
    body: 'Coming soon: Your event booths will become permanent Unreal-powered digital showrooms that designers can explore anytime.',
    highlightSelector: '[data-demo-id="showroom-coming-soon"]',
    position: 'top',
    actionHint: 'Learn about digital showrooms',
  },
];

const TOUR_COMPLETED_KEY_PREFIX = 'folioDemoTourCompleted_';

interface DemoGuidedTourProps {
  role: 'individual' | 'designer' | 'vendor';
}

export default function DemoGuidedTour({ role }: DemoGuidedTourProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [highlightElement, setHighlightElement] = useState<HTMLElement | null>(null);
  const [clickedElement, setClickedElement] = useState(false); // Track if user clicked highlighted element
  const stepRef = useRef<NodeJS.Timeout | null>(null);
  const clickHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const scrollExecutedRef = useRef<Set<string>>(new Set()); // Track which steps we've already scrolled for
  const highlightRectRef = useRef<DOMRect | null>(null); // Cache highlight rect to prevent recalculation
  const lastElementRef = useRef<HTMLElement | null>(null); // Track last element to prevent re-scrolling same element

  const steps = role === 'individual' 
    ? [...INDIVIDUAL_TOUR_STEPS, ...EVENTS_TOUR_STEPS]
    : role === 'designer'
    ? [...DESIGNER_TOUR_STEPS, ...EVENTS_TOUR_STEPS]
    : VENDOR_TOUR_STEPS;

  const tourCompletedKey = `${TOUR_COMPLETED_KEY_PREFIX}${role}`;

  const handleNext = useCallback(() => {
    const isLastStep = currentStepIndex === steps.length - 1;
    if (isLastStep) {
      setIsActive(false);
      localStorage.setItem(tourCompletedKey, 'true');
    } else {
      const nextStepIndex = currentStepIndex + 1;
      const nextStep = steps[nextStepIndex];
      
      // Reset clickedElement for next step
      setClickedElement(false);
      
      // Always update the step index first
      setCurrentStepIndex(nextStepIndex);
      
      // If next step is on a different route, navigate there
      // Otherwise, just advance the step (allows multiple steps on same route)
      const nextRouteBase = nextStep.route.replace('/*', '');
      const currentPathBase = pathname?.split('?')[0] || '';
      
      // Only navigate if we're not already on the route (or a child route)
      if (nextStep.route && !currentPathBase.startsWith(nextRouteBase)) {
        router.push(nextRouteBase);
      }
      // Otherwise, step will update via state change above
    }
  }, [currentStepIndex, steps, pathname, router, tourCompletedKey]);

  const handleSkip = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(tourCompletedKey, 'true');
  }, [tourCompletedKey]);

  const handleComplete = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(tourCompletedKey, 'true');
  }, [tourCompletedKey]);

  // Initialize tour once when component mounts (or user/role changes)
  useEffect(() => {
    if (typeof window === 'undefined' || !session?.user) return;
    if (isActive) return; // Don't re-initialize if tour is already active

    const userEmail = session.user.email;
    const userRole = normalizeRole(session.user.role);
    const isDemoUser = userEmail === 'demo@folio.com';
    const isCorrectRole = 
      (role === 'individual' && userRole === 'INDIVIDUAL') ||
      (role === 'designer' && userRole === 'DESIGNER') ||
      (role === 'vendor' && userRole === 'VENDOR');
    
    const alreadyCompleted = localStorage.getItem(tourCompletedKey) === 'true';

    // Activate tour if demo user, correct role, and not completed
    if (isDemoUser && isCorrectRole && !alreadyCompleted) {
      setIsActive(true);
      // Start at step 0 initially - step matching will happen in element finding
      setCurrentStepIndex(0);
    }
  }, [session?.user?.email, session?.user?.role, role, tourCompletedKey, isActive]);

  // Find and highlight the target element
  useEffect(() => {
    if (!isActive) {
      setHighlightElement(null);
      highlightRectRef.current = null;
      lastElementRef.current = null;
      return;
    }

    const currentStep = steps[currentStepIndex];
    if (!currentStep?.highlightSelector) {
      // No selector means no highlight needed - show tour immediately
      setHighlightElement(null);
      highlightRectRef.current = null;
      lastElementRef.current = null;
      return;
    }

    // Clear any existing timeout
    if (stepRef.current) {
      clearTimeout(stepRef.current);
      stepRef.current = null;
    }

    // Clean up previous click listener
    if (clickHandlerRef.current && lastElementRef.current) {
      lastElementRef.current.removeEventListener('click', clickHandlerRef.current);
      clickHandlerRef.current = null;
    }

    const stepKey = `${currentStep.id}-${currentStepIndex}`;
    const shouldScroll = !scrollExecutedRef.current.has(stepKey);

    const findElement = (retryCount = 0) => {
      const maxRetries = 3;
      
      // Try multiple selector strategies
      let element: HTMLElement | null = null;
      
      try {
        // Try the main selector first
        element = document.querySelector(currentStep.highlightSelector) as HTMLElement;
        
        // If not found and selector contains commas, try each part
        if (!element && currentStep.highlightSelector.includes(',')) {
          const selectors = currentStep.highlightSelector.split(',').map(s => s.trim());
          for (const sel of selectors) {
            element = document.querySelector(sel) as HTMLElement;
            if (element) break;
          }
        }
        
        // If still not found, try a more flexible approach for common patterns
        if (!element) {
          // Try finding by data attribute without exact match
          if (currentStep.highlightSelector.includes('data-demo-id')) {
            const attrMatch = currentStep.highlightSelector.match(/data-demo-id="([^"]+)"/);
            if (attrMatch) {
              element = document.querySelector(`[data-demo-id="${attrMatch[1]}"]`) as HTMLElement;
            }
          }
        }
      } catch (e) {
        console.warn('[DemoGuidedTour] Invalid selector:', currentStep.highlightSelector, e);
      }

      // Only update if element actually changed
      if (element && element !== lastElementRef.current) {
        console.log('[DemoGuidedTour] Found element for step', currentStep.id);
        
        lastElementRef.current = element;
        setHighlightElement(element);
        
        // Cache the rect immediately
        highlightRectRef.current = element.getBoundingClientRect();
        
        // Only scroll once per step, and only if we haven't scrolled for this step yet
        if (shouldScroll) {
          scrollExecutedRef.current.add(stepKey);
          // Use requestAnimationFrame to prevent scroll conflicts
          requestAnimationFrame(() => {
            if (element && element === lastElementRef.current) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }
        
        // If waitForClick is enabled, attach click listener
        if (currentStep.waitForClick) {
          setClickedElement(false); // Reset click state
          
          // Add new click listener
          const clickHandler = (e: MouseEvent) => {
            console.log('[DemoGuidedTour] User clicked highlighted element');
            setClickedElement(true);
            // Don't auto-advance - let user click Next button
          };
          
          clickHandlerRef.current = clickHandler;
          element.addEventListener('click', clickHandler, { once: true });
        }
      } else if (element === lastElementRef.current && element) {
        // Same element - just update the rect if needed, but don't re-scroll
        highlightRectRef.current = element.getBoundingClientRect();
      } else if (retryCount < maxRetries) {
        // Retry after a delay if element not found (may be loading)
        console.log(`[DemoGuidedTour] Element not found, retry ${retryCount + 1}/${maxRetries}:`, currentStep.highlightSelector);
        stepRef.current = setTimeout(() => findElement(retryCount + 1), 500);
      } else {
        // Element not found after retries, show tour anyway without highlight
        console.log('[DemoGuidedTour] Element not found after retries, showing tour without highlight:', currentStep.highlightSelector);
        setHighlightElement(null);
        highlightRectRef.current = null;
        lastElementRef.current = null;
      }
    };

    // Start finding element after a brief delay to let page render
    stepRef.current = setTimeout(() => findElement(0), 100);

    return () => {
      if (stepRef.current) {
        clearTimeout(stepRef.current);
        stepRef.current = null;
      }
      // Clean up click listener
      if (clickHandlerRef.current && lastElementRef.current) {
        lastElementRef.current.removeEventListener('click', clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
    };
  }, [isActive, currentStepIndex, steps]);

  // Auto-advance when route changes to next step's route
  // BUT only if we're moving to a DIFFERENT route (not same route with multiple steps)
  useEffect(() => {
    if (!isActive || !pathname) return;

    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    if (!nextStep) return;

    // Normalize routes for comparison
    const currentRouteBase = currentStep.route.split('?')[0].replace('/*', '');
    const nextRouteBase = nextStep.route.split('?')[0].replace('/*', '');
    const currentPathBase = pathname.split('?')[0];

    // Only auto-advance if:
    // 1. We're on the next step's route
    // 2. The next step's route is DIFFERENT from current step's route
    // 3. We're not already on the current step's route (to prevent loops)
    const isOnNextRoute = currentPathBase.startsWith(nextRouteBase);
    const routesAreDifferent = currentRouteBase !== nextRouteBase;
    const isNotOnCurrentRoute = !currentPathBase.startsWith(currentRouteBase) || currentPathBase !== currentRouteBase;

    if (isOnNextRoute && routesAreDifferent && isNotOnCurrentRoute) {
      console.log('[DemoGuidedTour] Auto-advancing due to route change', {
        fromRoute: currentRouteBase,
        toRoute: nextRouteBase,
        fromStep: currentStep.id,
        toStep: nextStep.id,
        currentPath: currentPathBase,
      });
      // Small delay to let the page render
      const timeoutId = setTimeout(() => {
        setCurrentStepIndex(prev => prev + 1);
      }, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [pathname, isActive, currentStepIndex, steps]);

  // Update cached rect periodically but not on every render
  useEffect(() => {
    if (!highlightElement) {
      highlightRectRef.current = null;
      return;
    }

    const updateRect = () => {
      if (highlightElement && highlightElement === lastElementRef.current) {
        highlightRectRef.current = highlightElement.getBoundingClientRect();
      }
    };

    // Update rect initially and on scroll/resize (but debounced)
    updateRect();
    const handleUpdate = () => {
      requestAnimationFrame(updateRect);
    };
    
    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [highlightElement]);

  // Debug: Log current state (only when step changes to reduce noise)
  useEffect(() => {
    if (isActive) {
      console.log('[DemoGuidedTour] Step changed', {
        role,
        currentStepIndex,
        currentStep: steps[currentStepIndex]?.id,
        pathname,
        hasHighlight: !!highlightElement,
      });
    }
  }, [isActive, currentStepIndex, role, steps]); // Removed pathname and highlightElement from deps to reduce logging

  // Early returns - all hooks must be above this point
  if (!isActive) {
    return null;
  }

  const currentStep = steps[currentStepIndex];
  if (!currentStep) {
    return null;
  }

  // Check if we're on the correct route (with flexibility for dynamic routes)
  const currentRouteBase = pathname?.split('?')[0] || '';
  let stepRouteBase = currentStep.route.split('?')[0];
  
  // Handle dynamic routes: route ending in /* means we check startsWith
  const isDynamicRoute = stepRouteBase.endsWith('/*');
  if (isDynamicRoute) {
    stepRouteBase = stepRouteBase.replace('/*', '');
  }
  
  // More lenient route matching - allow same base route for multiple steps
  const isOnCorrectRoute = 
    currentRouteBase === stepRouteBase || // Exact match
    (isDynamicRoute && currentRouteBase.startsWith(stepRouteBase + '/')) || // Dynamic route match
    (!isDynamicRoute && currentRouteBase.startsWith(stepRouteBase)); // Prefix match for non-dynamic
  
  // CRITICAL: Always show steps if we're on the correct route (allows multiple steps on same route)
  // This is key - multiple steps can be on /feed, and we want to show them all sequentially
  if (!isOnCorrectRoute) {
    return null;
  }

  const isLastStep = currentStepIndex === steps.length - 1;
  
  // Use cached rect if available, only recalculate if element changed
  const highlightRect = highlightElement && highlightRectRef.current 
    ? highlightRectRef.current 
    : (highlightElement?.getBoundingClientRect() || null);

  const highlightStyle = highlightRect
    ? {
        position: 'fixed' as const,
        top: highlightRect.top,
        left: highlightRect.left,
        width: highlightRect.width,
        height: highlightRect.height,
        borderRadius: '0.5rem',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.8)',
        pointerEvents: 'none' as const,
        zIndex: 90,
        transition: 'opacity 0.2s ease-out',
      }
    : null;

  // Calculate tooltip position
  const tooltipPosition = currentStep.position || 'bottom';
  const tooltipStyle: React.CSSProperties = highlightRect
    ? {
        position: 'fixed',
        zIndex: 100,
        ...(tooltipPosition === 'top' && {
          bottom: window.innerHeight - highlightRect.top + 20,
          left: highlightRect.left + highlightRect.width / 2,
          transform: 'translateX(-50%)',
        }),
        ...(tooltipPosition === 'bottom' && {
          top: highlightRect.bottom + 20,
          left: highlightRect.left + highlightRect.width / 2,
          transform: 'translateX(-50%)',
        }),
        ...(tooltipPosition === 'left' && {
          right: window.innerWidth - highlightRect.left + 20,
          top: highlightRect.top + highlightRect.height / 2,
          transform: 'translateY(-50%)',
        }),
        ...(tooltipPosition === 'right' && {
          left: highlightRect.right + 20,
          top: highlightRect.top + highlightRect.height / 2,
          transform: 'translateY(-50%)',
        }),
      }
    : {
        position: 'fixed',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
      };


  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        {highlightStyle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-80"
            style={{ zIndex: 85 }}
            aria-hidden="true"
          />
        )}

        {/* Highlight */}
        {highlightStyle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={highlightStyle}
            className="transition-all duration-300"
          />
        )}

        {/* Tooltip */}
        <motion.div
          key={currentStep.id} // Use step ID as key to prevent flickering when step changes
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          style={tooltipStyle}
          className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-80 pointer-events-auto"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-serif text-gray-900 mb-1">
                {currentStep.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                {currentStep.body}
              </p>
              {currentStep.actionHint && (
                <p className="text-xs text-blue-600 font-medium italic mb-3">
                  💡 {currentStep.actionHint}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Step {currentStepIndex + 1} of {steps.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Skip Tour
              </button>
              <button
                onClick={handleNext}
                disabled={currentStep.waitForClick && !clickedElement && highlightElement !== null}
                className="px-4 py-1.5 bg-folio-ink text-white text-xs font-medium rounded hover:bg-folio-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLastStep ? 'Finish' : (currentStep.waitForClick && !clickedElement ? 'Click highlighted element' : 'Next')}
              </button>
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

