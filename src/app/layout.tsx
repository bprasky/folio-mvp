import type { Metadata } from 'next';
import { Cormorant_Garamond, Instrument_Sans } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import SessionRoleSync from '../components/SessionRoleSync';
import RoleBasedLayout from '../components/layouts/RoleBasedLayout';
import { Toaster } from 'react-hot-toast';
import { ImpersonationBanner } from '../components/admin/ImpersonationBanner';

// Folio Design System - Typography
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-headline',
  display: 'swap',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FOLIO | Next-Gen Interior Design Platform',
  description: 'A curated design platform for interior designers and vendors',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${instrumentSans.variable}`}>
      <body className="bg-[var(--bg-base)] text-[var(--text-primary)] min-h-screen antialiased font-[var(--font-body)]">
        <Providers>
          <SessionRoleSync />
          <ImpersonationBanner />
          <RoleBasedLayout>
            {children}
          </RoleBasedLayout>
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
