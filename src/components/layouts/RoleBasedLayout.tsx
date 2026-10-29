"use client";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import SimpleLayout from "./SimpleLayout";
import { Navigation } from "../navigation";
import { Footer } from "../Footer";

// Ensure this layout is always dynamic to avoid stale header state
export const dynamic = 'force-dynamic';

interface RoleBasedLayoutProps {
  children: ReactNode;
}

export default function RoleBasedLayout({ children }: RoleBasedLayoutProps) {
  const pathname = usePathname();

  // Check if we're on an auth page where we might want to suppress navigation
  const isAuthPage = pathname?.startsWith('/auth/') || pathname?.startsWith('/onboarding');
  
  // For auth pages, render without layout to avoid navigation interference
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Marketing pages render full-width without SimpleLayout chrome or loading skeleton.
  const MARKETING_ROUTES = ['/about', '/for-designers'];
  const isMarketingRoute = MARKETING_ROUTES.some(route => pathname?.startsWith(route));

  if (isMarketingRoute) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  // Session resolution belongs to account controls and protected pages. Do not
  // replace public content with a generic skeleton or remount it on role changes.
  // MainLayout and SimpleLayout have identical content geometry; use one stable shell.

  // Long-form editorial routes paint a warm cream field. The class overrides
  // --surface so the sticky header's scrolled-state tint matches the page.
  const isEditorialRoute =
    pathname?.startsWith('/editorials/') ||
    pathname?.startsWith('/p/');
  const isProjectWorkspace = pathname?.startsWith('/project/') || pathname === '/projects/new';

  // Use new top navigation instead of NavFrame/GlassNavRail
  return (
    <div className={`flex flex-col min-h-screen${isEditorialRoute ? ' editorial-surface' : ''}`}>
      <Navigation />
      {/* Keep the content shell stable while the session resolves. */}
      {isProjectWorkspace || pathname === '/' ? <main className="min-w-0 flex-1">{children}</main> : (
        <SimpleLayout>{children}</SimpleLayout>
      )}
      <Footer />
    </div>
  );
}
