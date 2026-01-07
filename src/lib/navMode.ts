export type NavMode = 'top' | 'side' | 'landing_glass';

// Treat /events as an editorial/top route
const TOP_ROUTES = [/^\/(events|home|discover|editorials|designers)(\/|$)?/i];
const SIDE_ROUTES = [/^\/(vendor|analytics|dashboard|projects)(\/|$)?/i];
// Phase 1 integration: glass landing is /events (not /home)
const LANDING_ROUTES = ['/events'];

import { flags } from '@/lib/flags';

/** Source of truth used by useNavMode() */
export function navModeForPath(pathname: string): NavMode {
  // 0) Feature flag short-circuit
  if (!flags.glassLandingRail) {
    if (SIDE_ROUTES.some((r) => r.test(pathname))) return 'side';
    return 'top';
  }

  // 1) Landing glass until the first navigation away
  if (LANDING_ROUTES.includes(pathname) && typeof window !== 'undefined') {
    const firstDone = sessionStorage.getItem('folio:firstNavDone') === 'true';
    if (!firstDone) return 'landing_glass';
  }

  // 2) Workspace/metrics routes
  if (SIDE_ROUTES.some((r) => r.test(pathname))) return 'side';

  // 3) Editorial/public (default)
  if (TOP_ROUTES.some((r) => r.test(pathname))) return 'top';
  return 'top';
}


