import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip middleware for static files and API routes
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if accessing the auth page
  if (request.nextUrl.pathname === '/auth') {
    return NextResponse.next();
  }

  // Check for authentication cookie
  const authCookie = request.cookies.get('folio-auth');
  
  if (!authCookie || authCookie.value !== 'authenticated') {
    // Redirect to auth page
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 