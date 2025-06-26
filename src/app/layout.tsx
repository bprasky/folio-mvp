import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { RoleProvider } from '../contexts/RoleContext';
import GlobalHeader from '../components/GlobalHeader';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Folio | Next-Gen Interior Design Platform',
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
        <RoleProvider>
          <GlobalHeader />
          <main className="bg-folio-background">
            {children}
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
