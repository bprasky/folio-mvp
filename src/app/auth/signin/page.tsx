'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  GlassCard,
  EditorialHeadline,
  GlassInput,
  GlassButton,
  GlassDivider,
} from "@/components/ui/glass";

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: email.trim().toLowerCase(),
        password,
      });
      if (res?.error) {
        setErr(res.error || 'Invalid email or password');
      } else {
        router.replace('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

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
              Welcome back
            </EditorialHeadline>
            <p className="text-gray-600">
              Sign in to continue to Folio
            </p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <GlassInput
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                error={!!err}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <GlassInput
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                error={!!err}
              />
            </div>
            
            {err && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                {err}
              </div>
            )}
            
            <GlassButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </GlassButton>
          </form>
          
          <GlassDivider className="my-6" />
          
          <p className="text-center text-gray-600">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Create one
            </Link>
          </p>
        </GlassCard>
        
        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          By signing in, you agree to our{" "}
          <a href="/terms" className="underline hover:text-gray-700">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
} 