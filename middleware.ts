import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit, getClientIp, RateLimitPresets } from '@/lib/rateLimit';
import {
  nextOnboardingStep,
  resumePathForStep,
} from '@/lib/onboarding/resume';

// Routes exempt from the onboarding gate (and from status-based redirects).
// Public profile pages and account settings are reachable mid-onboarding per 17_ONBOARDING_FLOW.
const EXEMPT_ROUTES = [
  '/onboarding',
  '/auth',
  '/api',
  '/pending-approval',
  '/application-rejected',
  '/settings/account',
  '/p/',
  '/designer/',
  '/_next',
  '/favicon.ico',
];

// Auth routes that should be rate limited
const AUTH_RATE_LIMITED_ROUTES = [
  '/api/auth/signin',
  '/api/auth/callback/credentials',
];

// Roles that should never be funnelled through the guided onboarding sequence.
// Admins and vendor reps are onboarded through separate flows.
const ONBOARDING_EXEMPT_ROLES = new Set(['ADMIN', 'VENDOR']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting for auth endpoints (IP-level only, prevents mass attacks)
  // Per-email rate limiting happens in the authorize callback where we have email access
  if (AUTH_RATE_LIMITED_ROUTES.some((route) => pathname.startsWith(route))) {
    const clientIp = getClientIp(request.headers);
    const rateLimitResult = checkRateLimit(clientIp, {
      ...RateLimitPresets.LOGIN_PER_IP,
      keyGenerator: (ip) => `login-ip:${ip}`,
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many login attempts from this network. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset),
            'Retry-After': String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          },
        }
      );
    }
  }

  // Skip exempt routes (onboarding pages, auth, api, public profile, etc.)
  if (EXEMPT_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get the token/session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If not authenticated, let NextAuth handle it
  if (!token) {
    return NextResponse.next();
  }

  const role = token.role as string | undefined;
  const accountStatus = token.accountStatus as string;

  // Designer-only status gates (pre-existing behavior)
  if (role === 'DESIGNER') {
    if (accountStatus === 'PENDING') {
      return NextResponse.redirect(new URL('/pending-approval', request.url));
    }
    if (accountStatus === 'REJECTED') {
      return NextResponse.redirect(new URL('/application-rejected', request.url));
    }
  }

  // Universal onboarding gate (17_ONBOARDING_FLOW).
  // Skip for admins and vendor reps — they have their own flows.
  if (role && ONBOARDING_EXEMPT_ROLES.has(role)) {
    return NextResponse.next();
  }

  const step = nextOnboardingStep(role, {
    onboardingDiagnosticAt: token.onboardingDiagnosticAt as Date | null,
    onboardingFirmContextAt: token.onboardingFirmContextAt as Date | null,
    onboardingBioCaptureAt: token.onboardingBioCaptureAt as Date | null,
    onboardingProfilePreviewAt: token.onboardingProfilePreviewAt as Date | null,
  });

  if (step !== 'done') {
    return NextResponse.redirect(new URL(resumePathForStep(step), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
