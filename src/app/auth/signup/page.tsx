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

type UserRole = 'DESIGNER' | 'VENDOR' | 'HOMEOWNER';
type WaitlistType = 'VENDOR' | 'INDIVIDUAL';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'role' | 'details' | 'waitlist'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [waitlistType, setWaitlistType] = useState<WaitlistType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    website: '',
  });
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'DESIGNER') {
      setStep('details');
    } else {
      // Vendor or Homeowner -> show waitlist
      setWaitlistType(role === 'VENDOR' ? 'VENDOR' : 'INDIVIDUAL');
      setStep('waitlist');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: waitlistEmail,
          type: waitlistType,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setMessage(data.error || 'Failed to join waitlist');
      }
    } catch (error) {
      console.error('Waitlist error:', error);
      setMessage('Error joining waitlist. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

    // Website is required for designers (for admin approval)
    if (selectedRole === 'DESIGNER' && !formData.website.trim()) {
      setMessage('Website URL is required for designer accounts');
      setIsLoading(false);
      return;
    }

    try {
      // Create the user via API route (hardcoded as PERSONAL account type)
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: 'DESIGNER',
          accountType: 'personal',
          website: formData.website,
        }),
      });

      const data = await response.json();

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
          // Use redirectUrl from API response if provided (for designer onboarding)
          const redirectPath = data.redirectUrl || '/';
          setTimeout(() => {
            router.replace(redirectPath);
            router.refresh();
          }, 2000);
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

  const renderRoleSelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 mb-6">I am a...</h3>

      <button
        type="button"
        onClick={() => handleRoleSelect('DESIGNER')}
        className="w-full p-4 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-left shadow-sm"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold">D</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Interior Designer</h4>
            <p className="text-sm text-gray-600">Create projects, organize selections, build presentations</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => handleRoleSelect('VENDOR')}
        className="w-full p-4 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-left shadow-sm"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 font-semibold">V</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Vendor/Manufacturer</h4>
            <p className="text-sm text-gray-600">Create projects for designers, track specifications</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => handleRoleSelect('HOMEOWNER')}
        className="w-full p-4 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-left shadow-sm"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-purple-600 font-semibold">I</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Individual</h4>
            <p className="text-sm text-gray-600">Browse products, save favorites, connect with professionals</p>
          </div>
        </div>
      </button>
    </div>
  );

  const renderWaitlist = () => {
    const accountTypeLabel = waitlistType === 'VENDOR' ? 'vendor accounts' : 'individual accounts';
    const hasSubmitted = message && !message.includes('Error') && !message.includes('Failed');

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-900 mb-3">
            We're not quite ready for you yet.
          </h3>
          <p className="text-gray-600">
            Folio is launching with designers first. Leave your email and we'll notify you when {accountTypeLabel} are available.
          </p>
        </div>

        {hasSubmitted ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="text-green-700 font-medium">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleWaitlistSubmit} className="space-y-4">
            <div>
              <label htmlFor="waitlistEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <GlassInput
                id="waitlistEmail"
                name="waitlistEmail"
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {message && (
              <div className={`p-3 rounded-md border ${
                message.includes('Error') || message.includes('Failed')
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
              {isLoading ? 'Submitting...' : 'Notify Me'}
            </GlassButton>
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setStep('role');
              setMessage('');
              setWaitlistEmail('');
            }}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            &larr; Back to role selection
          </button>
        </div>
      </div>
    );
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

      {selectedRole === 'DESIGNER' && (
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1.5">
            Portfolio Website *
          </label>
          <GlassInput
            id="website"
            name="website"
            type="url"
            required
            value={formData.website}
            onChange={handleChange}
            placeholder="https://yourportfolio.com"
            autoComplete="url"
          />
          <p className="text-xs text-gray-500 mt-1">
            Required for account verification
          </p>
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-md border ${
          message.includes('Error') || message.includes('Failed') || message.includes('do not match')
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="flex space-x-3">
        <GlassButton
          type="button"
          onClick={() => {
            setStep('role');
            setMessage('');
          }}
          variant="secondary"
          size="lg"
          className="flex-1"
        >
          Back
        </GlassButton>
        <GlassButton
          type="submit"
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={isLoading}
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </GlassButton>
      </div>
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
              {step === 'waitlist' ? 'Coming Soon' : 'Join Folio'}
            </EditorialHeadline>
            {step !== 'waitlist' && (
              <p className="text-gray-600">
                Create your account to get started
              </p>
            )}
          </div>

          <div className="space-y-6">
            {step === 'role' && renderRoleSelection()}
            {step === 'details' && renderDetailsForm()}
            {step === 'waitlist' && renderWaitlist()}
          </div>

          {step === 'role' && (
            <>
              <GlassDivider className="my-6" />
              <p className="text-center text-gray-600">
                Already have an account?{" "}
                <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700 font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
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
