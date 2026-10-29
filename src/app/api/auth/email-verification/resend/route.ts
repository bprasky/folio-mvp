// @idor-allow: public-read reason="Resend is rate-limited and bound to the pending signup's browser secret"
import { NextRequest, NextResponse } from 'next/server';
import { limitSignupIp, resendSignup, SIGNUP_COOKIE } from '@/lib/auth/signup-verification';
import { sameOriginSignup, signupErrorResponse } from '@/lib/auth/signup-response';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    sameOriginSignup(request);
    await limitSignupIp(request.headers);
    const deliveryAccepted = await resendSignup(request.cookies.get(SIGNUP_COOKIE)?.value);
    return NextResponse.json({ deliveryAccepted }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return signupErrorResponse(error); }
}
