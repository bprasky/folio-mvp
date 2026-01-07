'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Client-side hook to get vendor ID from session
 * Falls back to user ID if vendor context is not available
 */
export function useVendorId(): string | null {
  const { data: session } = useSession();
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      // For now, use user ID as vendor ID
      // TODO: Fetch vendor org ID from API if needed
      setVendorId(session.user.id);
    } else {
      setVendorId(null);
    }
  }, [session]);

  return vendorId;
}


