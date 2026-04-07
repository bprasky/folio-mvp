'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface MagazineLoginScreenProps {
  onLogin: (credentials: { email: string; password: string }) => void;
  isLoading?: boolean;
}

export default function MagazineLoginScreen({ onLogin, isLoading = false }: MagazineLoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 relative overflow-hidden">
      {/* Magazine Cover Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-32 h-32 border border-folio-border-strong rotate-12" />
        <div className="absolute top-40 right-32 w-24 h-24 border border-folio-border-strong rotate-45" />
        <div className="absolute bottom-32 left-32 w-40 h-40 border border-folio-border-strong rotate-12" />
        <div className="absolute bottom-20 right-20 w-28 h-28 border border-folio-border-strong rotate-45" />
      </div>

      {/* Hero Image/Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-200/80 via-stone-300/60 to-stone-400/40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-stone-300 to-stone-500 rounded-full opacity-20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-stone-400 to-stone-600 rounded-full opacity-15 blur-3xl" />
      </div>

      {/* Folio Logo - Top Left */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.2 }}
        className="absolute top-8 left-8 z-20"
      >
        <div className="text-4xl font-serif text-folio-text-primary tracking-wider">
          FOLIO
        </div>
        <div className="text-sm text-folio-text-secondary tracking-widest uppercase mt-1">
          Design Magazine
        </div>
      </motion.div>

      {/* Magazine Cover Elements */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="absolute top-1/4 left-8 z-10"
      >
        <div className="text-6xl font-serif text-folio-text-secondary/60 leading-tight">
          <div>DESIGN</div>
          <div className="text-4xl mt-2">INTELLIGENCE</div>
        </div>
        <div className="text-lg text-folio-text-secondary mt-4 max-w-xs">
          Where architecture meets innovation, and design meets data.
        </div>
      </motion.div>

      {/* Login Form - Center */}
      <div className="flex items-center justify-center min-h-screen p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="w-full max-w-md"
        >
          <Card className="glass-surface border-folio-border-strong shadow-2xl">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-serif text-folio-text-primary mb-2">
                  Welcome Back
                </h2>
                <p className="text-folio-text-secondary">
                  Sign in to continue your design journey
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-folio-text-secondary">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-folio-border-strong focus:border-folio-border-subtle0"
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-folio-text-secondary">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-folio-border-strong focus:border-folio-border-subtle0"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-stone-800 hover:bg-stone-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing In...' : 'Enter Magazine'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-folio-text-tertiary">
                  New to Folio?{' '}
                  <a href="#" className="text-folio-text-secondary hover:text-folio-text-primary underline">
                    Request access
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Magazine Cover Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-8 right-8 text-right z-10"
      >
        <div className="text-folio-text-secondary text-sm">
          <div>VOL. 2024</div>
          <div className="text-xs mt-1">DESIGN INTELLIGENCE EDITION</div>
        </div>
      </motion.div>
    </div>
  );
}





