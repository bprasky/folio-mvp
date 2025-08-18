import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

export async function GET() {
  const jar = cookies();
  const cookieNames = (jar.getAll?.() ?? []).map(c => c.name);

  const supabase = supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  return NextResponse.json({
    supabaseUserId: user?.id ?? null,
    supabaseError: error?.message ?? null,
    cookieNames,
  });
} 