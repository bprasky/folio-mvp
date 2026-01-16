'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="folio-logo-text">Folio</span>
        </div>

        <RidgeCard size="lg" padding="xl">
          <div className="text-center mb-8">
            <h1 className="folio-h2 mb-2">Welcome back</h1>
            <p className="folio-body">
              Sign in to continue to Folio
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block folio-ui text-[var(--text-primary)] mb-1.5">
                Email
              </label>
              <Input
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
              <label htmlFor="password" className="block folio-ui text-[var(--text-primary)] mb-1.5">
                Password
              </label>
              <Input
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
              <div className="ridge-card ridge-card-sm p-3 bg-red-50 border-red-200 text-red-700 text-sm">
                {err}
              </div>
            )}

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="my-6 h-px bg-[var(--ridge-outer)]" />

          <p className="text-center folio-body">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium">
              Create one
            </Link>
          </p>
        </RidgeCard>

        {/* Footer */}
        <p className="text-center folio-meta mt-8">
          By signing in, you agree to our{" "}
          <a href="/terms" className="underline hover:text-[var(--text-secondary)]">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-[var(--text-secondary)]">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
} 