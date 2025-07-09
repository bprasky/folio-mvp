'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaLock } from 'react-icons/fa';

export default function AuthPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  console.log('AuthPage render - password:', password, 'isLoading:', isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    console.log('Submitting form with password:', password);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      console.log('Auth response status:', response.status);
      console.log('Auth response ok:', response.ok);

      if (response.ok) {
        console.log('Authentication successful, redirecting...');
        // Wait a moment for the cookie to be set, then redirect
        setTimeout(() => {
          router.push('/');
          router.refresh(); // Force a refresh to ensure middleware picks up the cookie
        }, 200);
      } else {
        const errorData = await response.json();
        console.log('Auth error:', errorData);
        setError('Invalid password. Please try again.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FaLock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Folio</h1>
          <p className="text-lg text-gray-600 mb-4">Design Platform</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">Coming Soon</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <p className="text-gray-600 leading-relaxed">
            A comprehensive design platform connecting homeowners, designers, and vendors with AI-powered project matching.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                console.log('Password changed:', e.target.value);
                setPassword(e.target.value);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter password to preview (folio2024)"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 py-2 px-4 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200"
          >
            {isLoading ? 'Authenticating...' : 'Enter Preview'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-900 mb-4 text-center">What's Inside</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-gray-600">AI Project Matching</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span className="text-gray-600">Designer Jobs Board</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-600">Vendor Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-gray-600">Portfolio Management</span>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/auth/signin')}
            className="text-sm text-blue-600 hover:text-blue-800 mb-4"
          >
            Need admin/vendor access? Sign in here →
          </button>
          <div className="text-sm text-gray-500">
            Built with ❤️ for the design community
          </div>
        </div>
      </div>
    </div>
  );
} 