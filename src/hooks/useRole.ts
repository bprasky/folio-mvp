import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function useRole() {
  const { data: session, status } = useSession();
  const [role, setRole] = useState<string | null>(null);

  // Mirror the session → local state (and optionally localStorage)
  useEffect(() => {
    if (status === 'loading') return;
    const newRole = session?.user?.role ?? null;
    setRole(newRole);
    try {
      if (newRole) localStorage.setItem('userRole', newRole);
      else localStorage.removeItem('userRole');
    } catch {}
  }, [session, status]);

  return { role, loading: status === 'loading' };
}








