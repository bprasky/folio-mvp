'use client';

import React from 'react';

interface LoginCardProps {
  children: React.ReactNode;
}

export default function LoginCard({ children }: LoginCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="bg-neutral-900/40 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/10 p-8">
        {/* Brand Lockup */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif text-white mb-2 tracking-wider">
            FOLIO
          </h1>
          <p className="text-sm text-neutral-300 tracking-widest uppercase">
            The professional hub where the design world connects.
          </p>
        </div>

        {/* Login Form Content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}




