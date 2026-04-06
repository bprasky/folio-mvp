'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TOCItem {
  id: string;
  title: string;
  level: number;
}

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  effectiveDate: string;
  children: React.ReactNode;
  tocItems: TOCItem[];
}

export function LegalPageLayout({
  title,
  lastUpdated,
  effectiveDate,
  children,
  tocItems,
}: LegalPageLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show back to top button after scrolling down
      setShowBackToTop(window.scrollY > 400);

      // Update active section based on scroll position
      const sections = tocItems.map((item) => document.getElementById(item.id));
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(tocItems[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tocItems]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Header */}
      <header className="border-b border-folio-border-subtle bg-surface-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-folio-text-secondary hover:text-folio-text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Folio</span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-[var(--font-headline)] font-semibold text-folio-text-primary">
            {title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-folio-text-secondary">
            <span>Last Updated: {lastUpdated}</span>
            <span>Effective Date: {effectiveDate}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-12">
          {/* Content */}
          <article className="legal-content prose prose-neutral max-w-none">
            {children}
          </article>

          {/* Table of Contents - Desktop Sidebar */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24">
              <div className="ridge-card p-5">
                <h2 className="text-sm font-semibold text-folio-text-primary mb-4 uppercase tracking-wide">
                  Table of Contents
                </h2>
                <ul className="space-y-2">
                  {tocItems.map((item) => (
                    <li
                      key={item.id}
                      style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                    >
                      <button
                        onClick={() => scrollToSection(item.id)}
                        className={cn(
                          'text-left text-sm transition-colors w-full',
                          activeSection === item.id
                            ? 'text-[var(--accent)] font-medium'
                            : 'text-folio-text-secondary hover:text-folio-text-primary'
                        )}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </aside>
        </div>
      </div>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={cn(
          'fixed bottom-6 right-6 p-3 rounded-full bg-[var(--accent)] text-white shadow-lg transition-all duration-300',
          'hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2',
          showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
        aria-label="Back to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}
