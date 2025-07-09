import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '../components/Providers';
import GlobalHeader from '../components/GlobalHeader';
import Navigation from '../components/Navigation';

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
        <Providers>
          <Navigation />
          <GlobalHeader />
          <main className="bg-folio-background ml-20 lg:ml-56">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
