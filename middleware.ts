import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that should not be redirected
const EXEMPT_ROUTES = [
  '/pending-approval',
  '/application-rejected',
  '/onboarding',
  '/magazine',
  '/auth',
  '/api',
  '/_next',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip exempt routes
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

  const onboardingCompletedAt = token.onboardingCompletedAt;

  // If user hasn't completed onboarding, redirect to onboarding
  if (!onboardingCompletedAt && pathname !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // Legacy: Only apply PENDING/REJECTED rules to designers
  // This allows designers from phase 1 to still go through approval
  if (token.role === 'DESIGNER') {
    const accountStatus = token.accountStatus as string;

    // Redirect based on account status
    if (accountStatus === 'PENDING') {
      return NextResponse.redirect(new URL('/pending-approval', request.url));
    }

    if (accountStatus === 'REJECTED') {
      return NextResponse.redirect(new URL('/application-rejected', request.url));
    }
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
