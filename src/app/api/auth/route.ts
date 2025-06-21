import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // Check if password matches (you can change this password)
    const correctPassword = process.env.PREVIEW_PASSWORD || 'folio2024';
    
    if (password === correctPassword) {
      // Create response with success
      const response = NextResponse.json({ success: true });
      
      // Set authentication cookie (expires in 24 hours)
      response.cookies.set('folio-auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
      
      return response;
    } else {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
} 