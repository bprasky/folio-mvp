import type { Metadata } from 'next';
import { Inter, Cormorant_Garamond, Montserrat } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import SessionRoleSync from '../components/SessionRoleSync';
import RoleBasedLayout from '../components/layouts/RoleBasedLayout';
import { Toaster } from 'react-hot-toast';

// Legacy font (backward compatibility)
const inter = Inter({ subsets: ['latin'] });

// New Folio design system fonts
const cormorantGaramond = Cormorant_Garamond({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
});

const montserrat = Montserrat({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
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
    <html lang="en" className={`${cormorantGaramond.variable} ${montserrat.variable}`}>
      <body className={`${inter.className} bg-folio-bg text-folio-ink min-h-screen antialiased`}>
        <Providers>
          <SessionRoleSync />
          <RoleBasedLayout>
            {children}
          </RoleBasedLayout>
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
