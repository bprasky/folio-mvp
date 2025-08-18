import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import SessionRoleSync from '../components/SessionRoleSync';
import RoleBasedLayout from '../components/layouts/RoleBasedLayout';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={`${inter.className} bg-folio-background text-folio-text min-h-screen`}>
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
