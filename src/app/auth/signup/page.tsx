'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

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
          setTimeout(() => {
            router.replace('/');
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
        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
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
        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
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
        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
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
        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
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
        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Full Name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={formData.name}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email Address *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="john@example.com"
        />
      </div>

      {accountType === 'ORGANIZATION' && (
        <>
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
              Organization Name *
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              required
              value={formData.companyName}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your Company Name"
            />
          </div>

          <div>
            <label htmlFor="organizationType" className="block text-sm font-medium text-gray-700">
              Organization Type *
            </label>
            <select
              id="organizationType"
              name="organizationType"
              required
              value={formData.organizationType}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password *
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm Password *
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="••••••••"
        />
      </div>

      {message && (
        <div className={`p-3 rounded-md ${
          message.includes('Error') || message.includes('Failed') 
            ? 'bg-red-100 text-red-700' 
            : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="flex space-x-3">
        {step !== 'role' && (
          <button
            type="button"
            onClick={() => setStep(step === 'details' ? 'account-type' : 'role')}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join Folio
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500">
              sign in to your existing account
            </Link>
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {step === 'role' && renderRoleSelection()}
          {step === 'account-type' && renderAccountTypeSelection()}
          {step === 'details' && renderDetailsForm()}
        </div>
      </div>
    </div>
  );
} 