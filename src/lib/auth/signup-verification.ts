import 'server-only';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';
import { checkRateLimit, getClientIp, RateLimitPresets } from '@/lib/rateLimit';
import { signupReturnTo } from '@/lib/onboarding/professional-entry';
export { signupReturnTo } from '@/lib/onboarding/professional-entry';

export const SIGNUP_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-folio-signup' : 'folio-signup';
export const SIGNUP_COOKIE_OPTIONS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 3600 };
const CODE_LIFETIME = 10 * 60_000;
const RESEND_DELAY = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;

export class SignupVerificationError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function codeHash(id: string, code: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new SignupVerificationError('UNAVAILABLE', 503);
  return createHmac('sha256', secret).update(`signup:${id}:${code}`).digest('hex');
}
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function signupCookieFromHeader(header?: string) {
  return header?.split(';').map(part => part.trim()).find(part => part.startsWith(SIGNUP_COOKIE + '='))?.slice(SIGNUP_COOKIE.length + 1);
}
export async function pendingSignup(cookie?: string) {
  if (!cookie || !/^[\da-f-]{36}\.[\da-f]{64}$/.test(cookie)) return null;
  const [id, secret] = cookie.split('.');
  const challenge = await prisma.signupEmailChallenge.findUnique({ where: { id } });
  if (!challenge || !equal(challenge.secretHash, hash(secret)) || challenge.purgeAt <= new Date()) return null;
  return challenge;
}
export function signupState(challenge: NonNullable<Awaited<ReturnType<typeof pendingSignup>>>) {
  return {
    email: challenge.email, returnTo: challenge.returnTo,
    expiresAt: challenge.expiresAt.toISOString(),
    resendAt: new Date(challenge.lastSentAt.getTime() + RESEND_DELAY).toISOString(),
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - challenge.attempts),
    canResend: challenge.sends < MAX_SENDS && challenge.attempts < MAX_ATTEMPTS,
    deliveryAccepted: challenge.deliveryAccepted,
  };
}
export async function limitSignupEmail(email: string) {
  const limit = await checkRateLimit(hash(email), { max: 5, windowMs: 60 * 60_000, keyGenerator: key => `signup-email:${key}` });
  if (!limit.success) throw new SignupVerificationError('RATE_LIMIT', 429);
}
export async function limitSignupIp(headers: Headers) {
  const limit = await checkRateLimit(getClientIp(headers), { ...RateLimitPresets.SIGNUP_PER_IP, keyGenerator: ip => `signup-ip:${ip}` });
  if (!limit.success) throw new SignupVerificationError('RATE_LIMIT', 429);
}
async function deliver(id: string, email: string, code: string, digest: string) {
  const result = await sendEmail({
    to: email, subject: 'Your Folio email verification code',
    html: `<h1>Confirm your email</h1><p>Enter this code in the Folio signup window:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${code}</p><p>This code expires in 10 minutes and can be used once. Never share it with anyone.</p><p>If you did not start signing up for Folio, you can ignore this email.</p>`,
    idempotencyKey: `signup-verification/${id}/${digest}`,
  });
  if (result.success) await prisma.signupEmailChallenge.updateMany({ where: { id, codeHash: digest }, data: { deliveryAccepted: true } });
  return result.success;
}
export async function beginSignup(input: { email: string; name: string; passwordHash: string; returnTo?: string }) {
  if (!process.env.RESEND_API_KEY || !process.env.NEXTAUTH_SECRET) throw new SignupVerificationError('UNAVAILABLE', 503);
  const now = new Date(), id = randomUUID(), secret = randomBytes(32).toString('hex');
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0'), digest = codeHash(id, code);
  // Expired pending credentials never become accounts; remove them on subsequent signup activity.
  await prisma.signupEmailChallenge.deleteMany({ where: { purgeAt: { lt: now } } });
  await prisma.signupEmailChallenge.create({ data: {
    id, email: input.email, name: input.name, passwordHash: input.passwordHash,
    secretHash: hash(secret), codeHash: digest, returnTo: signupReturnTo(input.returnTo), consentAt: now,
    expiresAt: new Date(now.getTime() + CODE_LIFETIME), purgeAt: new Date(now.getTime() + 3600_000), lastSentAt: now,
  } });
  // Keep the browser's resumable signup even if acceptance bookkeeping fails.
  const delivered = await deliver(id, input.email, code, digest).catch(() => false);
  return { cookie: `${id}.${secret}`, delivered };
}
export async function resendSignup(cookie?: string) {
  const challenge = await pendingSignup(cookie);
  if (!challenge) throw new SignupVerificationError('MISSING', 404);
  const now = new Date();
  if (challenge.attempts >= MAX_ATTEMPTS) throw new SignupVerificationError('ATTEMPTS');
  if (challenge.sends >= MAX_SENDS || now.getTime() - challenge.lastSentAt.getTime() < RESEND_DELAY) throw new SignupVerificationError('RATE_LIMIT', 429);
  await limitSignupEmail(challenge.email);
  let code: string, digest: string;
  do {
    code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    digest = codeHash(challenge.id, code);
  } while (digest === challenge.codeHash);
  const changed = await prisma.signupEmailChallenge.updateMany({
    where: { id: challenge.id, codeHash: challenge.codeHash, lastSentAt: challenge.lastSentAt, attempts: { lt: MAX_ATTEMPTS }, sends: { lt: MAX_SENDS }, purgeAt: { gt: now } },
    data: { codeHash: digest, expiresAt: new Date(now.getTime() + CODE_LIFETIME), lastSentAt: now, sends: { increment: 1 }, deliveryAccepted: false },
  });
  if (!changed.count) throw new SignupVerificationError('RATE_LIMIT', 429);
  return deliver(challenge.id, challenge.email, code, digest).catch(() => false);
}
export async function verifySignup(cookie: string | undefined, code: string) {
  if (!/^\d{6}$/.test(code)) throw new SignupVerificationError('INVALID');
  const challenge = await pendingSignup(cookie);
  if (!challenge) throw new SignupVerificationError('MISSING');
  const now = new Date();
  if (challenge.attempts >= MAX_ATTEMPTS) throw new SignupVerificationError('ATTEMPTS');
  if (challenge.expiresAt <= now) throw new SignupVerificationError('EXPIRED');
  const current = { id: challenge.id, codeHash: challenge.codeHash, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: now }, purgeAt: { gt: now } };
  if (!equal(challenge.codeHash, codeHash(challenge.id, code))) {
    await prisma.signupEmailChallenge.updateMany({ where: current, data: { attempts: { increment: 1 } } });
    throw new SignupVerificationError('INVALID');
  }
  try {
    return await prisma.$transaction(async tx => {
      // The conditional delete serializes consumption against verification, resends and failed attempts.
      // Creating the account in the same transaction makes replay and partial completion impossible.
      const consumed = await tx.signupEmailChallenge.deleteMany({ where: current });
      if (consumed.count !== 1) throw new SignupVerificationError('INVALID');
      const existing = await tx.user.findFirst({ where: { email: { equals: challenge.email, mode: 'insensitive' } }, select: { id: true } });
      if (existing) throw new SignupVerificationError('EXISTS');
      return tx.user.create({ data: {
        email: challenge.email, name: challenge.name, passwordHash: challenge.passwordHash,
        role: 'INDIVIDUAL', accountStatus: 'APPROVED',
        tosAcceptedAt: challenge.consentAt, privacyAcceptedAt: challenge.consentAt,
        tosVersion: '2026-01-19', privacyVersion: '2026-01-19',
      }, select: { id: true, email: true, name: true, role: true } });
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new SignupVerificationError('EXISTS');
    throw error;
  }
}
