import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { SignupVerificationError } from './signup-verification';

export function sameOriginSignup(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new SignupVerificationError('FORBIDDEN', 403);
}
export function signupErrorResponse(error: unknown) {
  const known = error instanceof SignupVerificationError;
  const code = known ? error.code : 'UNAVAILABLE';
  const messages: Record<string, string> = {
    MISSING: 'Your signup has expired. Please start again.',
    ATTEMPTS: 'Too many incorrect codes. Please start signup again.',
    RATE_LIMIT: 'Please wait before trying again. Too many attempts may require waiting an hour.',
    FORBIDDEN: 'Please continue from the Folio signup page.',
    UNAVAILABLE: 'We could not complete this step. Please try again shortly.',
  };
  // Avoid logging pending credentials, OTPs, or database query arguments.
  if (!known) console.error('[Signup verification] Request failed');
  return NextResponse.json({ error: messages[code] || messages.UNAVAILABLE, code }, { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
