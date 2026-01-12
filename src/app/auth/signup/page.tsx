'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import {
  GlassCard,
  EditorialHeadline,
  GlassInput,
  GlassButton,
  GlassDivider,
} from "@/components/ui/glass";

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

    try {
      // Individual-First: All users created as INDIVIDUAL role
      const requestBody = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
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
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
          Full Name *
        </label>
        <GlassInput
          id="name"
          name="name"
          type="text"
          required
          value={formData.name}
          onChange={handleChange}
          placeholder="John Doe"
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
          Email Address *
        </label>
        <GlassInput
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
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
          Password *
        </label>
        <GlassInput
          id="password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="********"
          autoComplete="new-password"
        />
        <p className="text-xs text-gray-500 mt-1">
          At least 8 characters
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
          Confirm Password *
        </label>
        <GlassInput
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

      {message && (
        <div className={`p-3 rounded-md border ${
          message.includes('Error') || message.includes('Failed') || message.includes('do not match')
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <GlassButton
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </GlassButton>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-semibold text-gray-900">Folio</span>
        </div>

        <GlassCard variant="strong" padding="xl" rounded="3xl">
          <div className="text-center mb-8">
            <EditorialHeadline size="lg" className="mb-2">
              Join Folio
            </EditorialHeadline>
            <p className="text-gray-600">
              Create your account to get started
            </p>
          </div>

          <div className="space-y-6">
            {renderDetailsForm()}
          </div>

          <GlassDivider className="my-6" />
          <p className="text-center text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </GlassCard>

        <p className="text-center text-sm text-gray-500 mt-8">
          By creating an account, you agree to our{" "}
          <a href="/terms" className="underline hover:text-gray-700">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
