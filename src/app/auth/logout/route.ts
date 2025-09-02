import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const c = cookies();

  // 1) Clear NextAuth cookies (JWT strategy)
  // NextAuth names vary; clear broadly and safely:
  const toDelete = [
    'next-auth.session-token',
    'next-auth.csrf-token',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.csrf-token',
  ];
  for (const name of toDelete) try { c.delete(name); } catch {}

  // 2) Clear your custom cookies
  ['folio-session', 'userRole', 'activeProfileId'].forEach(n => { try { c.delete(n); } catch {} });

  // 3) Return JSON so client can wipe localStorage and redirect
  return NextResponse.json({ ok: true });
}


