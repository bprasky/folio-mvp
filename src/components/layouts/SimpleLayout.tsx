"use client";
import { ReactNode, useState, useEffect } from "react";
import Navigation from "@/components/Navigation";

export default function SimpleLayout({ children }: { children: ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll for navigation shadow effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Fixed Navigation Sidebar - Hidden on mobile */}
      <aside className={`hidden md:block fixed left-0 top-0 h-screen w-[var(--nav-w)] overflow-y-auto border-r border-folio-border bg-white z-40 transition-shadow duration-200 nav-scrollbar ${
        isScrolled ? 'shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.15)]' : ''
      }`}>
        <Navigation />
      </aside>

      {/* Main Content Area - Responsive padding */}
      <main className="md:pl-[var(--nav-w)] pl-0">
        <div className="pt-[var(--app-top-pad,theme(space.4))] px-6 pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Navigation (hidden on desktop) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-folio-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            {/* Mobile Navigation Icon */}
            <button className="p-2 rounded-lg hover:bg-gray-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Mobile Logo */}
            <div className="text-lg font-semibold">FOLIO</div>
          </div>
          {/* Mobile Profile */}
          <div className="w-8 h-8 bg-gradient-to-r from-folio-accent to-folio-system rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
} 