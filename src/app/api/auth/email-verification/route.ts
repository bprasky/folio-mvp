// @idor-allow: public-read reason="Signup state requires its unguessable HTTP-only browser secret"
import { NextRequest, NextResponse } from 'next/server';
import { pendingSignup, signupState, SIGNUP_COOKIE, SIGNUP_COOKIE_OPTIONS, SignupVerificationError } from '@/lib/auth/signup-verification';
import { signupErrorResponse } from '@/lib/auth/signup-response';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const challenge = await pendingSignup(request.cookies.get(SIGNUP_COOKIE)?.value);
    if (!challenge) {
      const response = signupErrorResponse(new SignupVerificationError('MISSING', 404));
      response.cookies.set(SIGNUP_COOKIE, '', { ...SIGNUP_COOKIE_OPTIONS, maxAge: 0 });
      return response;
    }
    return NextResponse.json(signupState(challenge), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return signupErrorResponse(error); }
}
