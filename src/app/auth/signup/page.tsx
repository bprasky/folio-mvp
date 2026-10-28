'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeCallbackPath, professionalSetupHref } from '@/lib/onboarding/professional-entry';
import Link from 'next/link';
import { getProviders, signIn, useSession } from 'next-auth/react';

import { Topbar } from '../_components/Topbar';
import { PhotoPanel } from '../_components/PhotoPanel';
import { PageFooter } from '../_components/PageFooter';
import { AuthFormField } from '../_components/AuthFormField';
import { SsoRow } from '../_components/SsoRow';
import { AuthDivider } from '../_components/AuthDivider';
import { AgreementCheckbox } from '../_components/AgreementCheckbox';
import { PasswordStrengthMeter } from '../_components/PasswordStrengthMeter';
import '../_components/auth.css';

// Individual-First Architecture: All users sign up as individuals.
// Org membership (designer/vendor) is additive and handled separately.

const POST_SIGNUP_REDIRECT_BROWSING = '/onboarding/diagnostic';

type UserIntent = 'browsing' | 'designer' | 'architect' | 'builder' | 'vendor';

const INTENT_OPTIONS: { value: UserIntent; label: string }[] = [
  { value: 'browsing', label: 'Just browsing' },
  { value: 'designer', label: 'Designer' },
  { value: 'architect', label: 'Architect' },
  { value: 'builder', label: 'Builder' },
  { value: 'vendor', label: 'Vendor' },
];

function intentToRedirect(intent: UserIntent, startProject: boolean): string {
  if (intent === 'browsing') return POST_SIGNUP_REDIRECT_BROWSING;
  return professionalSetupHref(intent, startProject ? '/projects/new' : undefined);
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();
  const requestedCallback = params.get('callbackUrl') ?? params.get('callback');
  const callbackUrl = requestedCallback ? safeCallbackPath(requestedCallback) : null;
  const [intent, setIntent] = useState<UserIntent>(() => {
    const type = params.get('type');
    return INTENT_OPTIONS.some(option => option.value === type) ? type as UserIntent : 'browsing';
  });
  const destination = callbackUrl ?? intentToRedirect(intent, params.get('next') === 'project');
  const signinHref = '/auth/signin?callbackUrl=' + encodeURIComponent(destination);
  useEffect(() => {
    if (status === 'authenticated') router.replace(destination);
  }, [status, router, destination]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success' | null>(null);
  const [providers, setProviders] = useState({ google: false, apple: false });

  useEffect(() => {
    let active = true;
    getProviders().then((available) => {
      if (active) setProviders({ google: !!available?.google, apple: !!available?.apple });
    }).catch(() => {
      // Email signup remains available if provider discovery fails.
    });
    return () => { active = false; };
  }, []);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    acceptedTerms &&
    !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setMessageType(null);

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters');
      setMessageType('error');
      setIsLoading(false);
      return;
    }
    if (!acceptedTerms) {
      setMessage('You must agree to the Terms of Service and Privacy Policy');
      setMessageType('error');
      setIsLoading(false);
      return;
    }

    try {
      const name = `${firstName.trim()} ${lastName.trim()}`.trim();
      const requestBody = {
        name,
        email,
        password,
        acceptedTerms: true,
        tosVersion: '2026-01-19',
        privacyVersion: '2026-01-19',
      };

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Failed to create account');
        setMessageType('error');
        setIsLoading(false);
        return;
      }

      setMessage('Account created. Signing you in…');
      setMessageType('success');

      const signInResult = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (signInResult?.error) {
        setMessage('Account created but sign-in failed. Please sign in manually.');
        setMessageType('error');
        setIsLoading(false);
        return;
      }

      // Intent overrides the API's onboarding redirect: pros go to org setup,
      // browsers continue to the existing onboarding diagnostic.
      router.replace(destination);
      router.refresh();
    } catch (error) {
      console.error('Signup error:', error);
      setMessage('Error creating account. Please try again.');
      setMessageType('error');
      setIsLoading(false);
    }
  };

  const handleSso = async (provider: 'google' | 'apple') => {
    setIsLoading(true);
    setMessage('');
    setMessageType(null);
    try {
      await signIn(provider, { callbackUrl: destination });
    } catch {
      setMessage('Unable to start sign-in. Please try again or sign up with email.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <Topbar rightCta={{ label: 'Sign in', href: signinHref }} />

      <main className="auth-stage">
        <PhotoPanel
          imageSrc="https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=80"
          imageAlt="Sitting room in cream linen and oak, soft afternoon light"
          eyebrow="From Issue 09 · Cape Town"
          description="The sitting room — pared back to one long bench of bleached oak, a pair of woven cane chairs, and the linen drape that softens the afternoon. Restraint as a posture, not an absence."
          counter="03 / 04"
        />

        <section className="auth-form-panel" aria-label="Join Folio">
          <div className="auth-eyebrow">
            <span className="auth-eyebrow__gold">Sign up</span>
          </div>
          <h1 className="auth-title">Create your Folio account.</h1>
          <p className="auth-sub">
            Your account belongs to you. To publish your work, join or create
            your firm, then bring in your first project.
          </p>

          <fieldset className="auth-intent">
            <legend className="auth-intent__legend">Describe yourself</legend>
            <div className="auth-intent__chips" role="radiogroup" aria-label="Describe yourself">
              {INTENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`auth-intent__chip${intent === opt.value ? ' auth-intent__chip--on' : ''}`}
                >
                  <input
                    type="radio"
                    name="intent"
                    value={opt.value}
                    checked={intent === opt.value}
                    onChange={() => setIntent(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {(providers.google || providers.apple) && (
            <>
              <SsoRow
                showGoogle={providers.google}
                showApple={providers.apple}
                onGoogleClick={() => handleSso('google')}
                onAppleClick={() => handleSso('apple')}
                disabled={isLoading}
              />
              <AuthDivider />
            </>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-row-2">
              <AuthFormField
                id="firstName"
                name="firstName"
                label="First name"
                type="text"
                placeholder="Lena"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <AuthFormField
                id="lastName"
                name="lastName"
                label="Last name"
                type="text"
                placeholder="Caldera"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <AuthFormField
              id="email"
              name="email"
              label="Work email"
              type="email"
              placeholder="you@studio.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <AuthFormField
              id="password"
              name="password"
              label="Password"
              helperRight="Minimum 8 characters"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <PasswordStrengthMeter password={password} />

            <AgreementCheckbox
              id="acceptedTerms"
              checked={acceptedTerms}
              onChange={setAcceptedTerms}
            >
              I agree to the{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
              , and consent to occasional editorial updates from Folio.
            </AgreementCheckbox>

            {message ? (
              <div
                className={`auth-message ${
                  messageType === 'success' ? 'auth-message--success' : 'auth-message--error'
                }`}
                role={messageType === 'error' ? 'alert' : 'status'}
              >
                {message}
              </div>
            ) : null}

            <button type="submit" className="auth-submit" disabled={!canSubmit}>
              {isLoading ? 'Creating your account…' : 'Sign up'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </form>

          <div className="auth-form-foot">
            Already with us?{' '}
            <Link href={signinHref}>Sign in</Link>{' '}
            — we&rsquo;ll take you back to your projects.
          </div>
        </section>
      </main>

      <PageFooter />
    </div>
  );
}

export default function SignupPage() {
  return <React.Suspense fallback={null}><SignupForm /></React.Suspense>;
}
