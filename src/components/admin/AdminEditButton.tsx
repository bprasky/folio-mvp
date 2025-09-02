'use client';
import { useSession } from 'next-auth/react';
import { isAdmin, normalizeRole } from '@/lib/permissions';
import Link from 'next/link';

export default function AdminEditButton({ eventId }: { eventId: string }) {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return null;
  
  const role = normalizeRole(session?.user?.role);
  if (!isAdmin(role)) return null;

  // Dev-only logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[AdminEditButton] Normalized role:', role);
  }

  return (
    <Link
      href={`/admin/events/new?edit=${eventId}`}
      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border hover:bg-muted"
    >
      Edit
    </Link>
  );
}


