'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Individual-First Architecture: All users sign up as individuals
// Org membership (designer/vendor) is additive and handled separately

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (formData.password !== formData.confirmPassword) {
      setMessage('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setMessage('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setMessage('You must agree to the Terms of Service and Privacy Policy');
      setIsLoading(false);
      return;
    }

    try {
      // Individual-First: All users created as INDIVIDUAL role
      const requestBody = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        acceptedTerms: true,
        tosVersion: '2026-01-19',
        privacyVersion: '2026-01-19',
      };
      console.log('[Signup] Sending request with body:', { ...requestBody, password: '[REDACTED]' });

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[Signup] Response status:', response.status);
      const data = await response.json();
      console.log('[Signup] Response data:', data);

      if (response.ok) {
        setMessage('Account created successfully! Signing you in...');

        // Immediately sign in with the new credentials
        const signInResult = await signIn('credentials', {
          redirect: false,
          email: formData.email,
          password: formData.password,
        });

        if (signInResult?.error) {
          setMessage('Account created but sign-in failed. Please sign in manually.');
        } else {
          setMessage('Account created and signed in successfully! Redirecting...');
          // Redirect to home - individuals can browse immediately
          const redirectPath = data.redirectUrl || '/';
          setTimeout(() => {
            router.replace(redirectPath);
            router.refresh();
          }, 1500);
        }
      } else {
        setMessage(data.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setMessage('Error creating account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderDetailsForm = () => (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block folio-ui text-[var(--text-primary)] mb-1.5">
          Full Name *
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          value={formData.name}
          onChange={handleChange}
          placeholder="John Doe"
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="off"
        />
      </div>

      <div>
        <label htmlFor="email" className="block folio-ui text-[var(--text-primary)] mb-1.5">
          Email Address *
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="password" className="block folio-ui text-[var(--text-primary)] mb-1.5">
          Password *
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="********"
          autoComplete="new-password"
        />
        <p className="folio-meta mt-1">
          At least 8 characters
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block folio-ui text-[var(--text-primary)] mb-1.5">
          Confirm Password *
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="********"
          autoComplete="new-password"
          error={formData.password !== formData.confirmPassword && formData.confirmPassword.length > 0}
        />
      </div>

      {/* Terms and Privacy Consent */}
      <div className="flex items-start gap-3">
        <input
          id="acceptedTerms"
          name="acceptedTerms"
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-[var(--ridge-outer)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
        />
        <label htmlFor="acceptedTerms" className="text-sm text-[var(--text-secondary)] cursor-pointer">
          I agree to the{' '}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline underline-offset-2"
          >
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:text-[var(--accent-hover)] underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          {' '}*
        </label>
      </div>

      {message && (
        <div className={`ridge-card ridge-card-sm p-3 ${
          message.includes('Error') || message.includes('Failed') || message.includes('do not match')
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="folio-logo-text">Folio</span>
        </div>

        <RidgeCard size="lg" padding="xl">
          <div className="text-center mb-8">
            <h1 className="folio-h2 mb-2">Join Folio</h1>
            <p className="folio-body">
              Create your account to get started
            </p>
          </div>

          <div className="space-y-6">
            {renderDetailsForm()}
          </div>

          <div className="my-6 h-px bg-[var(--ridge-outer)]" />
          <p className="text-center folio-body">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium">
              Sign in
            </Link>
          </p>
        </RidgeCard>

        <p className="text-center folio-meta mt-8">
          Read our{" "}
          <Link href="/cookies" className="underline hover:text-[var(--text-secondary)]">Cookie Policy</Link>
          {" "}for information about how we use cookies.
        </p>
      </div>
    </div>
  );
}
