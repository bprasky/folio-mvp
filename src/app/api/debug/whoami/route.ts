import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Get all cookies from the request
    const cookies = request.cookies.getAll();
    
    // Filter for NextAuth-related cookies
    const nextAuthCookies = cookies
      .filter(cookie => 
        cookie.name.startsWith('next-auth') || 
        cookie.name.startsWith('__Secure-next-auth')
      )
      .map(cookie => cookie.name);

    // Get the current session using NextAuth
    const session = await getServerSession(authOptions);

    // Return the debug information
    return NextResponse.json({
      cookiesPresent: nextAuthCookies,
      session: session ? {
        email: session.user?.email,
        role: session.user?.role
      } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in whoami debug route:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get debug info',
        cookiesPresent: [],
        session: null 
      },
      { status: 500 }
    );
  }
} 