"use client";

// src/components/layout/FolioBanner.tsx
//
// Universal FOLIO Banner Component
//
// Site-wide banner that appears on all pages:
// - Large serif "FOLIO" title (clickable link to /magazine)
// Note: Navigation tabs are reserved for the /magazine page only

import Link from "next/link";

export default function FolioBanner() {
  return (
    <div className="w-full bg-surface-elevated border-b border-folio-border-subtle">
      <div className="mx-auto max-w-7xl px-4 py-7 md:px-6 md:py-10">
        <header className="flex flex-col items-center justify-center text-center">
          {/* FOLIO Title - Maximized size, refined thin font weight, clickable link */}
          <Link 
            href="/magazine"
            className="text-6xl md:text-8xl lg:text-9xl font-light tracking-[-0.02em] text-folio-text-primary leading-[0.95] hover:opacity-80 transition-opacity"
            style={{ fontFamily: 'var(--brand-font), ui-serif, Georgia, "Times New Roman", serif', fontWeight: 300 }}
          >
            FOLIO
          </Link>
        </header>
      </div>
    </div>
  );
}

