'use client';
import { useEffect, useRef } from 'react';
import useNavMode from '@/hooks/useNavMode';
import { usePathname } from 'next/navigation';
import GlassNavRail from './GlassNavRail';
import FolioBanner from '../layout/FolioBanner';

export default function NavFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathname = useRef<string | null>(null);
  const mode = useNavMode();

  // Mark "first nav done" once user leaves landing for the first time
  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    
    const LANDING_ROUTES = ['/home', '/landing'];
    const wasOnLanding = prevPathname.current && LANDING_ROUTES.includes(prevPathname.current);
    const isLeavingLanding = wasOnLanding && !LANDING_ROUTES.includes(pathname);
    
    if (isLeavingLanding) {
      // console.log('[NavFrame] First navigation completed, setting firstNavDone flag');
      sessionStorage.setItem('folio:firstNavDone', 'true');
    }
    
    prevPathname.current = pathname;
  }, [pathname]);

  // Body class management for theme
  useEffect(() => {
    const clsLight = 'frame-light';
    const clsDark = 'frame-dark';
    
    if (mode === 'top' || mode === 'landing_glass') {
      document.body.classList.add(clsLight);
      document.body.classList.remove(clsDark);
    } else {
      document.body.classList.add(clsDark);
      document.body.classList.remove(clsLight);
    }
    
    return () => { 
      document.body.classList.remove(clsLight, clsDark); 
    };
  }, [mode]);

  // Check if we're on vendor dashboard - always use warm brand background regardless of nav mode
  const isVendorDashboard = pathname === '/vendor/dashboard';
  
  // Determine outer container background
  // Vendor dashboard always gets warm brand background, even if nav mode is 'side' (which would normally be dark)
  const outerBg = isVendorDashboard
    ? 'bg-[#F6F4F1] text-[#1B1B1A]' // Warm brand background for vendor dashboard
    : mode === 'top' || mode === 'landing_glass'
      ? 'bg-[#F6F4F1] text-[#1B1B1A]' // Light background for other light mode pages
      : 'bg-[#161616] text-neutral-100'; // Dark background for dark mode pages (side nav)
  
  return (
    <div className={outerBg}>
      {/* Glass Landing Rail - Active on all routes via handle */}
      <GlassNavRail mode={mode} />
      
      {/* DISABLED: Old TopNav/SideNav - Now replaced by GlassNavRail */}
      {/* The glass rail handle is always visible and provides access to navigation on all pages */}
      {/* To revert to old navigation, set flags.glassLandingRail = false */}

      {/* Page canvas - Full bleed, no sidebar offset (glass rail overlays) */}
      {/* Vendor dashboard gets explicit warm brand background on main content area */}
      <main className={isVendorDashboard ? 'bg-[#F6F4F1]' : 'bg-transparent'}>
        <FolioBanner />
        {children}
      </main>
    </div>
  );
}


