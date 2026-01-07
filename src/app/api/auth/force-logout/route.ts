import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  try {
    const response = NextResponse.json({ 
      ok: true, 
      cleared: [
        'next-auth.session-token',
        '__Secure-next-auth.session-token', 
        'next-auth.csrf-token',
        'next-auth.callback-url'
      ],
      message: 'All NextAuth cookies cleared'
    });

    // Clear all NextAuth cookies by setting them to expire immediately
    const cookiesToClear = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url'
    ];

    cookiesToClear.forEach(cookieName => {
      const isSecure = cookieName.startsWith('__Secure-');
      response.cookies.set(cookieName, '', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
        expires: new Date(0) // Thu, 01 Jan 1970 00:00:00 GMT
      });
    });

    return response;

  } catch (error) {
    console.error('Error in force-logout:', error);
    return NextResponse.json(
      { error: 'Failed to force logout' },
      { status: 500 }
    );
  }
} 