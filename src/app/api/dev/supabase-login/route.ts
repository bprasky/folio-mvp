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

  const jar = cookies();
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
      get: (n) => jar.get(n)?.value,
      set: (n, v, o) => jar.set({ name: n, value: v, ...o }),
      remove: (n, o) => jar.set({ name: n, value: '', ...o, maxAge: 0 }),
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