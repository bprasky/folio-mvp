import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Routes that require designer approval
const DESIGNER_ROUTES = ['/designer'];

// Routes that should not be redirected (even for pending/rejected users)
const EXEMPT_ROUTES = [
  '/pending-approval',
  '/application-rejected',
  '/onboarding',
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

  // Check if this is a designer route
  const isDesignerRoute = DESIGNER_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!isDesignerRoute) {
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

  // Only apply these rules to designers
  if (token.role !== 'DESIGNER') {
    return NextResponse.next();
  }

  const accountStatus = token.accountStatus as string;
  const onboardingCompletedAt = token.onboardingCompletedAt;

  // Redirect based on account status
  if (accountStatus === 'PENDING') {
    return NextResponse.redirect(new URL('/pending-approval', request.url));
  }

  if (accountStatus === 'REJECTED') {
    return NextResponse.redirect(new URL('/application-rejected', request.url));
  }

  // If approved but hasn't completed onboarding, redirect to onboarding
  if (accountStatus === 'APPROVED' && !onboardingCompletedAt) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
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
