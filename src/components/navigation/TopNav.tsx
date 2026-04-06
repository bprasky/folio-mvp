"use client";

import { ReactNode } from "react";

interface TopNavProps {
  children?: ReactNode;
}

export function TopNav({ children }: TopNavProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-folio-border-subtle bg-surface-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-surface-canvas/60">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {children}
      </nav>
    </header>
  );
}

