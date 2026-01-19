export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  // Debug routes only available in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await auth();
  return NextResponse.json({
    ok: Boolean(session),
    user: session?.user ?? null,
  });
}