"use client";
import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import MainLayout from "./MainLayout";
import SimpleLayout from "./SimpleLayout";
import { Navigation } from "../navigation";
import { Footer } from "../Footer";

// Ensure this layout is always dynamic to avoid stale header state
export const dynamic = 'force-dynamic';

interface RoleBasedLayoutProps {
  children: ReactNode;
}

export default function RoleBasedLayout({ children }: RoleBasedLayoutProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Check if we're on an auth page where we might want to suppress navigation
  const isAuthPage = pathname?.startsWith('/auth/');
  
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

  // Show loading state while session is being determined (authenticated routes only)
  if (status === 'loading') {
    return (
      <div className="flex flex-col min-h-screen w-full bg-surface-canvas">
        <div className="h-16 bg-surface-canvas border-b border-folio-border-subtle animate-pulse" />
        <main className="flex-1 pt-4 px-6 pb-8 overflow-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-surface-ground rounded mb-4"></div>
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-surface-ground rounded"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Determine which layout to use based on user role
  const userRole = session?.user?.role?.toLowerCase() || 'guest';

  // Long-form editorial routes paint a warm cream field. The class overrides
  // --surface so the sticky header's scrolled-state tint matches the page.
  const isEditorialRoute =
    pathname?.startsWith('/editorials/') ||
    pathname?.startsWith('/p/');

  // Use new top navigation instead of NavFrame/GlassNavRail
  return (
    <div className={`flex flex-col min-h-screen${isEditorialRoute ? ' editorial-surface' : ''}`}>
      <Navigation />
      {/* Use MainLayout for admin and vendor users (more features) */}
      {['admin', 'vendor'].includes(userRole) ? (
        <MainLayout>{children}</MainLayout>
      ) : (
        <SimpleLayout>{children}</SimpleLayout>
      )}
      <Footer />
    </div>
  );
} 