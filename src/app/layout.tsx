import type { Metadata } from 'next';
import { Cormorant_Garamond, Instrument_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { themeInitializationScript } from '@/lib/theme';
import { LoadingBrandProvider } from '@/components/loading/LoadingBrand';
import Providers from './providers';
import SessionRoleSync from '../components/SessionRoleSync';
import RoleBasedLayout from '../components/layouts/RoleBasedLayout';
import { Toaster } from 'react-hot-toast';
import { ImpersonationBanner } from '../components/admin/ImpersonationBanner';
import { CookieConsentBanner } from '../components/CookieConsentBanner';

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

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Folio — Interior design, in detail',
  description:
    'A working magazine for interior designers. Editorial features, materials, and the studios shaping them.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${cormorant.variable} ${instrumentSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="bg-surface-canvas text-folio-text-primary min-h-screen antialiased font-[var(--font-body)]">
        <Providers>
          <SessionRoleSync />
          <ImpersonationBanner />
          <LoadingBrandProvider>
            <RoleBasedLayout>{children}</RoleBasedLayout>
          </LoadingBrandProvider>
          <Toaster position="top-right" />
          <CookieConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
