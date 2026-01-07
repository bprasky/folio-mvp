import { redirect } from 'next/navigation';

/**
 * Redirect /vendor/my-events to /vendor/dashboard
 * 
 * This route has been consolidated into the unified vendor dashboard.
 * Individual event analytics remain at /vendor/my-events/[eventId]
 * 
 * Telemetry: Track redirect via console for monitoring (14 days)
 */
export default async function VendorMyEventsRedirect() {
  // Log redirect for monitoring (can be replaced with proper telemetry later)
  if (process.env.NODE_ENV === 'development') {
    console.log('[vendor-my-events-redirect] Redirecting to /vendor/dashboard');
  }

  // Permanent redirect to unified dashboard
  redirect('/vendor/dashboard');
}

/* 
 * OLD IMPLEMENTATION - DEPRECATED
 * 
 * The events listing and portfolio insights have been migrated to:
 * - /vendor/dashboard (Events tab) - Unified dashboard with Events & Projects tabs
 * 
 * Individual event analytics remain at:
 * - /vendor/my-events/[eventId] - Detailed event analytics dashboard
 * 
 * Components migrated:
 * - Event cards grid → VendorEventsTab
 * - Portfolio KPIs → VendorEventsTab
 * - Events comparison → VendorEventsTab
 * - Portfolio growth → VendorEventsTab
 * - Benchmarks → VendorEventsTab
 */
