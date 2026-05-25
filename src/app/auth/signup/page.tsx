'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

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

const POST_SIGNUP_REDIRECT = '/onboarding/diagnostic';

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success' | null>(null);

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

      const redirectPath = data.redirectUrl || POST_SIGNUP_REDIRECT;
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      console.error('Signup error:', error);
      setMessage('Error creating account. Please try again.');
      setMessageType('error');
      setIsLoading(false);
    }
  };

  const handleGoogle = () =>
    signIn('google', { callbackUrl: POST_SIGNUP_REDIRECT });
  const handleApple = () =>
    signIn('apple', { callbackUrl: POST_SIGNUP_REDIRECT });

  return (
    <div className="auth-shell">
      <Topbar rightCta={{ label: 'Sign in', href: '/auth/signin' }} />

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
            <span className="auth-eyebrow__gold">Apply</span>
            <span className="auth-eyebrow__dot" />
            <span>By invitation</span>
          </div>
          <h1 className="auth-title">Join Folio — on the trade&rsquo;s own terms.</h1>
          <p className="auth-sub">
            Read the design story straight from the studios that wrote it —
            every room credits its designer, every piece its maker. The private
            network for studios and the brands they specify opens once your
            organization joins.
          </p>

          <SsoRow onGoogleClick={handleGoogle} onAppleClick={handleApple} disabled={isLoading} />

          <AuthDivider />

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
              {isLoading ? 'Requesting access…' : 'Request access'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </form>

          <div className="auth-form-foot">
            Already with us?{' '}
            <Link href="/auth/signin">Sign in</Link>{' '}
            — we&rsquo;ll take you back to your projects.
          </div>
        </section>
      </main>

      <PageFooter />
    </div>
  );
}
