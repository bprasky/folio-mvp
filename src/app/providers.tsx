'use client';

import { ReactNode, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { RoleProvider } from '../contexts/RoleContext';
import { usePathname } from "next/navigation";

function CompactRouteFlag() {
  const pathname = usePathname();
  useEffect(() => {
    const isFestivalDetail = /^\/events\/[^/]+$/.test(pathname || "");
    if (isFestivalDetail) {
      document.documentElement.setAttribute("data-compact", "true");
    } else {
      document.documentElement.removeAttribute("data-compact");
    }
  }, [pathname]);
  return null;
}

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <RoleProvider>
        <CompactRouteFlag />
        {children}
      </RoleProvider>
    </SessionProvider>
  );
} 