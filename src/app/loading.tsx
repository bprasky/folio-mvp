'use client';

import { usePathname } from 'next/navigation';
import { LoadingSurface } from '@/components/loading/LoadingBrand';
import { HomepageSkeleton } from '@/components/homepage/HomepageSkeleton';

export default function Loading() {
  const pathname = usePathname();
  // This root boundary is inherited by other routes. Never show the homepage
  // layout on a workspace/article/auth route that has no dedicated skeleton.
  return (
    <LoadingSurface>
      {pathname === '/' || pathname === '/magazine'
        ? <HomepageSkeleton />
        : <div className="min-h-[40vh]" />}
    </LoadingSurface>
  );
}
