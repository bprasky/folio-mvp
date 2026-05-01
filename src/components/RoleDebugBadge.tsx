'use client';
import { useSession } from 'next-auth/react';

export default function RoleDebugBadge() {
  const { data: s, status } = useSession();
  
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div className="fixed bottom-2 right-2 text-[var(--type-fine)] px-2 py-1 rounded bg-black/60 text-white z-50">
      {status === 'loading' ? 'session: loading…' : `role: ${(s?.user as any)?.role ?? 'anon'}`}
    </div>
  );
}



















