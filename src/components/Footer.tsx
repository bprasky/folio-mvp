'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const legalLinks = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookies', label: 'Cookie Policy' },
];

const socialLinks = [
  { href: 'https://instagram.com/folioad', label: 'Instagram' },
];

export function Footer() {
  const pathname = usePathname();

  // Don't show footer on auth pages or legal pages (they have their own layout)
  const hideFooterPaths = ['/auth/', '/privacy', '/terms', '/cookies'];
  const shouldHideFooter = hideFooterPaths.some(path => pathname?.startsWith(path));

  if (shouldHideFooter) {
    return null;
  }

  return (
    <footer
      className="mt-auto bg-surface-ground border-t border-folio-border-subtle"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Brand */}
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="font-[var(--font-headline)] text-xl font-semibold text-folio-text-primary tracking-wide"
            >
              FOLIO
            </Link>
            <p className="text-sm text-folio-text-tertiary">
              The interior design ecosystem
            </p>
          </div>

          {/* Legal Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Legal">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-folio-text-secondary hover:text-folio-text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Social & Copyright */}
          <div className="flex flex-col md:items-end gap-2">
            <div className="flex gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <p className="text-xs text-folio-text-tertiary">
              &copy; {new Date().getFullYear()} Folio AD, LLC. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
