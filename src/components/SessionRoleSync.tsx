'use client';

import { useSession } from 'next-auth/react';
import { useRole } from '../contexts/RoleContext';
import { useEffect } from 'react';

export default function SessionRoleSync() {
  const { data: session } = useSession();
  const { setRole } = useRole();

  useEffect(() => {
    if (session?.user?.role) {
      // Convert the session role to lowercase to match RoleContext types
      const sessionRole = session.user.role.toLowerCase() as any;
      setRole(sessionRole);
    }
  }, [session?.user?.role, setRole]);

  return null; // This component doesn't render anything
} 