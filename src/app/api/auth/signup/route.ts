// @idor-allow: public-read reason="Pending signup is anonymous and cannot authenticate until email verification"
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { beginSignup, limitSignupEmail, limitSignupIp, SIGNUP_COOKIE, SIGNUP_COOKIE_OPTIONS } from '@/lib/auth/signup-verification';
import { signupErrorResponse, sameOriginSignup } from '@/lib/auth/signup-response';

export const dynamic = 'force-dynamic';
const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email address').max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  acceptedTerms: z.boolean().refine(value => value, { message: 'You must agree to the Terms of Service and Privacy Policy' }),
  returnTo: z.string().max(4096).optional(),
});

export async function POST(request: NextRequest) {
  try {
    sameOriginSignup(request);
    await limitSignupIp(request.headers);
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    const { name, email, password, returnTo } = parsed.data;
    await limitSignupEmail(email);
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'Unable to create account. Please try a different email or sign in.' }, { status: 400 });
    const result = await beginSignup({ name, email, passwordHash: await bcrypt.hash(password, 12), returnTo });
    const response = NextResponse.json({ verificationRequired: true, deliveryAccepted: result.delivered, redirectUrl: '/auth/verify-email' }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(SIGNUP_COOKIE, result.cookie, SIGNUP_COOKIE_OPTIONS);
    return response;
  } catch (error) { return signupErrorResponse(error); }
}
