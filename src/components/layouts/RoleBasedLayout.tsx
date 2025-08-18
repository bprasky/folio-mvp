"use client";
import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import MainLayout from "./MainLayout";
import SimpleLayout from "./SimpleLayout";

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
      <div className="flex min-h-screen w-full bg-gray-50">
        <div className="bg-white border-r border-folio-border w-64 p-6 h-screen flex flex-col shadow-sm">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-8"></div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
        <main className="flex-1 pt-4 px-6 pb-8 overflow-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Determine which layout to use based on user role
  const userRole = session?.user?.role?.toLowerCase() || 'guest';

  // Use MainLayout for admin and vendor users (more features)
  if (['admin', 'vendor'].includes(userRole)) {
    return <MainLayout>{children}</MainLayout>;
  }

  // Use SimpleLayout for other users (cleaner, simpler)
  return <SimpleLayout>{children}</SimpleLayout>;
} 