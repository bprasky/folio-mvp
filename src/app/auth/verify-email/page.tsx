'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { signupReturnTo } from '@/lib/onboarding/professional-entry';
import { SetupProgress } from '@/components/onboarding/SetupProgress';
import { Topbar } from '../_components/Topbar';
import { PhotoPanel } from '../_components/PhotoPanel';
import { PageFooter } from '../_components/PageFooter';
import { AuthFormField } from '../_components/AuthFormField';
import '../_components/auth.css';

type PendingSignup = {
  email: string; returnTo: string; expiresAt: string; resendAt: string;
  attemptsRemaining: number; canResend: boolean; deliveryAccepted: boolean;
};
const errors: Record<string, string> = {
  INVALID: 'That code did not match. Check the most recent email and try again.',
  EXPIRED: 'That code has expired. Request a new code below.',
  ATTEMPTS: 'Too many incorrect codes. Please start signup again.',
  MISSING: 'This signup has expired or was already completed. Sign in or start again.',
  EXISTS: 'An account already exists for this email. Please sign in.',
  RATE_LIMIT: 'Too many attempts. Please wait before trying again.',
  UNAVAILABLE: 'We could not complete verification. Please try again shortly.',
};
function VerifyEmailForm() {
  const router = useRouter(), params = useSearchParams();
  const { status } = useSession();
  const fallback = signupReturnTo(params.get('callbackUrl'));
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const destination = signupReturnTo(pending?.returnTo || fallback);
  const signupHref = '/auth/signup?callbackUrl=' + encodeURIComponent(destination);
  const signinHref = '/auth/signin?callbackUrl=' + encodeURIComponent(destination);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/email-verification', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 404) setPending(null);
        setError(data.error || errors.UNAVAILABLE);
        return;
      }
      setPending(data);
    } catch { setError(errors.UNAVAILABLE); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (status === 'authenticated') { router.replace(destination); router.refresh(); }
  }, [status, router, destination]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!pending || busy || !/^\d{6}$/.test(code)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await signIn('email-verification', { code, redirect: false, callbackUrl: destination });
      if (!result?.ok || result.error) {
        setError(errors[result?.error || 'UNAVAILABLE'] || errors.UNAVAILABLE);
        await refresh();
        return;
      }
      router.replace(destination); router.refresh();
    } catch { setError(errors.UNAVAILABLE); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/auth/email-verification/resend', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) setError(data.error || errors.UNAVAILABLE);
      else {
        setCode('');
        if (data.deliveryAccepted) setNotice('A new code is on its way. Only the most recent code will work.');
        else setError('We could not confirm email delivery. If a code arrives, you can still use it, or try resending shortly.');
      }
      await refresh();
    } catch { setError(errors.UNAVAILABLE); }
    finally { setBusy(false); }
  }
  const wait = pending ? Math.max(0, Math.ceil((Date.parse(pending.resendAt) - now) / 1000)) : 0;
  const expired = pending ? Date.parse(pending.expiresAt) <= now : false;
  const exhausted = pending?.attemptsRemaining === 0;
  return <div className="auth-shell auth-verify-shell">
    <Topbar rightCta={{ label: 'Sign in', href: signinHref }} />
    <main className="auth-stage">
      <PhotoPanel imageSrc="https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=80"
        imageAlt="Sitting room in cream linen and oak, soft afternoon light" eyebrow="Your place in Folio"
        description="One personal account. Your business, your work, and a workspace prepared around you." counter="01 / 03" />
      <section className="auth-form-panel" aria-label="Verify your email">
        <div className="auth-eyebrow"><span className="auth-eyebrow__gold">Your account</span></div>
        {destination.startsWith('/auth/org-setup') && <SetupProgress step={1} />}
        <h1 className="auth-title">Check your email.</h1>
        {loading ? <p role="status" className="auth-sub">Loading your signup…</p> : pending ? <>
          <p className="auth-sub">Enter the six-digit code sent to <strong>{pending.email}</strong> to finish creating your personal account.
            {destination.startsWith('/auth/org-setup') ? ' Next, you’ll find or create your business.' : ' Then you can continue into Folio.'}</p>
          {!pending.deliveryAccepted && <p className="auth-message auth-message--error" role="status">We could not confirm email delivery. You can use the code if it arrives, or resend it below.</p>}
          {exhausted ? <p role="alert" className="auth-message auth-message--error">{errors.ATTEMPTS}</p> : <form className="auth-form" onSubmit={submit}>
            <AuthFormField id="verification-code" name="code" label="Verification code" helperRight="Valid for 10 minutes"
              inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
              value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-describedby="verification-help" disabled={busy} />
            <p id="verification-help" className="auth-verify-help">{expired ? 'Your code has expired. Request a new one below.' : 'Use the most recent code and keep this signup window open.'}</p>
            <button className="auth-submit" type="submit" disabled={busy || code.length !== 6 || expired}>{busy ? 'Please wait…' : 'Verify email & continue'}</button>
          </form>}
          <div className="auth-verify-resend">
            <p>Can’t find it? Check your spam folder.</p>
            <button className="auth-verify-link" type="button" onClick={resend} disabled={busy || !pending.canResend || wait > 0}>
              {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
            </button>
            {!pending.canResend && !exhausted && <p>You’ve reached the resend limit. Try signup again later.</p>}
          </div>
        </> : null}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        {notice && <p className="auth-message auth-message--success" role="status">{notice}</p>}
        {!loading && !pending && <button className="auth-verify-link" type="button" onClick={() => { setError(''); void refresh(); }}>Try loading again</button>}
        <div className="auth-form-foot"><Link href={signupHref}>{pending && !exhausted ? 'Use a different email' : 'Start signup again'}</Link><br />Already verified? <Link href={signinHref}>Sign in</Link></div>
      </section>
    </main>
    <PageFooter />
  </div>;
}
export default function VerifyEmailPage() {
  return <React.Suspense fallback={null}><VerifyEmailForm /></React.Suspense>;
}
