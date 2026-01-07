"use client";
import { ReactNode } from "react";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Navigation is now handled by RoleBasedLayout with new top navigation */}

      {/* Main Content Area */}
      <main className="flex-1 bg-transparent">
        <div className="pt-4 px-6 pb-8 bg-transparent">
          {children}
        </div>
      </main>
    </div>
  );
} 