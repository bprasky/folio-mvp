'use client';
import { usePathname } from 'next/navigation';
import { navModeForPath, NavMode } from '@/lib/navMode';

export default function useNavMode(): NavMode {
  const pathname = usePathname() || '/';
  return navModeForPath(pathname);
}





