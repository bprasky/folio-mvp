"use client";
import { ReactNode } from "react";

export default function SimpleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Navigation is now handled by RoleBasedLayout with new top navigation */}

      {/* Main Content Area */}
      <main className="flex-1">
        <div className="pt-4 px-6 pb-8">
          {children}
        </div>
      </main>
    </div>
  );
} 