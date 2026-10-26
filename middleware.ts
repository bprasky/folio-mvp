import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
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

// Roles that should never be funnelled through the guided onboarding sequence.
// Admins and vendor reps are onboarded through separate flows.
const ONBOARDING_EXEMPT_ROLES = new Set(['ADMIN', 'VENDOR']);

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/_next/image') {
    const source = request.nextUrl.searchParams.get('url') || '';
    // The optimizer caches independently of project visibility and cookies.
    try {
      const target = new URL(source, request.url);
      if (target.pathname.startsWith('/api/project-photos/')) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    } catch { return new NextResponse(null, { status: 400 }); }
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;

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
    '/_next/image',
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
