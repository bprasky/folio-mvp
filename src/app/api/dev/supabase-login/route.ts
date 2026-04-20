// @idor-allow: public-read reason="Dev-only Supabase login helper; 403s in production via NODE_ENV check"
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'email and password required' }, { status: 400 });
  }

  const jar = await cookies();
  const cookieBefore = (jar.getAll?.() ?? []).map(c => c.name);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return NextResponse.json({
      ok: false,
      error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
      env: { hasUrl: !!url, hasAnon: !!anon }
    }, { status: 500 });
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            jar.set(name, value, options)
          );
        } catch {
          // Server Component context
        }
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      env: { hasUrl: !!url, hasAnon: !!anon }
    }, { status: 400 });
  }

  const { data: { user }, error: getErr } = await supabase.auth.getUser();

  const cookieAfter = (jar.getAll?.() ?? []).map(c => c.name);

  return NextResponse.json({
    ok: true,
    userId: user?.id ?? null,
    supabaseGetUserError: getErr?.message ?? null,
    cookiesBefore: cookieBefore,
    cookiesAfter: cookieAfter,
    note: 'Cookies are set for the current origin that called this route.',
  });
} 