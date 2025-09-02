'use client';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function LogoutButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const doLogout = () => start(async () => {
    // 1) End NextAuth session (no automatic redirect)
    await signOut({ redirect: false });

    // 2) Clear custom cookies on the server
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });

    // 3) Defensive: wipe local client state
    try {
      localStorage.removeItem('userRole');
      localStorage.removeItem('activeProfileId');
      localStorage.removeItem('project_draft');
    } catch {}

    // 4) Hard replace to signin
    router.replace('/auth/signin');
  });

  return (
    <button disabled={pending} onClick={doLogout}>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}


