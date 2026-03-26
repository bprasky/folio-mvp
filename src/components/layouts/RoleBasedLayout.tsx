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

  // Show loading state while session is being determined
  if (status === 'loading') {
    return (
      <div className="flex flex-col min-h-screen w-full bg-[var(--bg-base)]">
        <div className="h-16 bg-[var(--bg-base)] border-b border-[var(--ridge-outer)] animate-pulse" />
        <main className="flex-1 pt-4 px-6 pb-8 overflow-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--bg-elevated)] rounded mb-4"></div>
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-[var(--bg-elevated)] rounded"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Marketing pages render full-width without SimpleLayout chrome
  const MARKETING_ROUTES = ['/about', '/for-designers'];
  const isMarketingPage = MARKETING_ROUTES.some(route => pathname?.startsWith(route))
    || (pathname === '/' && !session);

  if (isMarketingPage) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  // Determine which layout to use based on user role
  const userRole = session?.user?.role?.toLowerCase() || 'guest';

  // Use new top navigation instead of NavFrame/GlassNavRail
  return (
    <div className="flex flex-col min-h-screen">
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