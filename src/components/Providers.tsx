"use client";

import { SessionProvider } from 'next-auth/react';
import { RoleProvider } from '../contexts/RoleContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RoleProvider>
        {children}
      </RoleProvider>
    </SessionProvider>
  );
} 