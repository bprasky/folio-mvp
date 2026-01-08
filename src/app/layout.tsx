import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import SessionRoleSync from '../components/SessionRoleSync';
import RoleBasedLayout from '../components/layouts/RoleBasedLayout';
import { Toaster } from 'react-hot-toast';
import { ImpersonationBanner } from '../components/admin/ImpersonationBanner';

// Use CSS custom properties for fonts instead of next/font/google
// This avoids network dependency during build while allowing fonts to be loaded via CSS

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
    <html lang="en">
      <body className="text-folio-ink min-h-screen antialiased font-sans">
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
