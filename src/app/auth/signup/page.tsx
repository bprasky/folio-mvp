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
type AccountType = 'PERSONAL' | 'ORGANIZATION';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'role' | 'account-type' | 'details'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    organizationType: 'DESIGN_FIRM',
    website: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'HOMEOWNER') {
      setAccountType('PERSONAL');
      setStep('details');
    } else {
      setStep('account-type');
    }
  };

  const handleAccountTypeSelect = (type: AccountType) => {
    setAccountType(type);
    setStep('details');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    if (!selectedRole || !accountType) {
      setMessage('Please complete all steps');
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
      // First, create the user via API route
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: selectedRole,
          accountType: accountType.toLowerCase(),
          organizationName: accountType === 'ORGANIZATION' ? formData.companyName : undefined,
          organizationDescription: accountType === 'ORGANIZATION' ? `${formData.companyName} - ${selectedRole} organization` : undefined,
          website: selectedRole === 'DESIGNER' ? formData.website : undefined,
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
            <span className="text-purple-600 font-semibold">H</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Homeowner</h4>
            <p className="text-sm text-gray-600">Browse products, save favorites, connect with professionals</p>
          </div>
        </div>
      </button>
    </div>
  );

  const renderAccountTypeSelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 mb-6">
        How would you like to use Folio?
      </h3>
      
      <button
        type="button"
        onClick={() => handleAccountTypeSelect('PERSONAL')}
        className="w-full p-4 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-left shadow-sm"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <span className="text-orange-600 font-semibold">👤</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Personal Account</h4>
            <p className="text-sm text-gray-600">Individual use, perfect for freelancers and personal projects</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => handleAccountTypeSelect('ORGANIZATION')}
        className="w-full p-4 bg-white/50 backdrop-blur-sm border border-gray-200/70 rounded-xl hover:border-blue-400 hover:bg-white/70 transition-all text-left shadow-sm"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-indigo-600 font-semibold">🏢</span>
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Organization Account</h4>
            <p className="text-sm text-gray-600">Team collaboration, multiple users, company branding</p>
          </div>
        </div>
      </button>
    </div>
  );

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

      {accountType === 'ORGANIZATION' && (
        <>
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">
              Organization Name *
            </label>
            <GlassInput
              id="companyName"
              name="companyName"
              type="text"
              required
              value={formData.companyName}
              onChange={handleChange}
              placeholder="Your Company Name"
            />
          </div>

          <div>
            <label htmlFor="organizationType" className="block text-sm font-medium text-gray-700 mb-1.5">
              Organization Type *
            </label>
            <select
              id="organizationType"
              name="organizationType"
              required
              value={formData.organizationType}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200/70 rounded-xl text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-colors"
            >
              {selectedRole === 'DESIGNER' ? (
                <>
                  <option value="DESIGN_FIRM">Design Firm</option>
                  <option value="ARCHITECTURE_FIRM">Architecture Firm</option>
                  <option value="INTERIOR_DESIGN_STUDIO">Interior Design Studio</option>
                </>
              ) : (
                <>
                  <option value="VENDOR">Vendor/Manufacturer</option>
                  <option value="SHOWROOM">Showroom</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="CONTRACTOR">Contractor</option>
                </>
              )}
            </select>
          </div>
        </>
      )}

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
          placeholder="••••••••"
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
          placeholder="••••••••"
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
          message.includes('Error') || message.includes('Failed') 
            ? 'bg-red-50 border-red-200 text-red-700' 
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="flex space-x-3">
        {step !== 'role' && (
          <GlassButton
            type="button"
            onClick={() => setStep(step === 'details' ? 'account-type' : 'role')}
            variant="secondary"
            size="lg"
            className="flex-1"
          >
            Back
          </GlassButton>
        )}
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
              Join Folio
            </EditorialHeadline>
            <p className="text-gray-600">
              Create your account to get started
            </p>
          </div>
          
          <div className="space-y-6">
            {step === 'role' && renderRoleSelection()}
            {step === 'account-type' && renderAccountTypeSelection()}
            {step === 'details' && renderDetailsForm()}
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