import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await getServerSession(authOptions);
  const cookieDump = cookies().getAll().map(c => ({ name: c.name, v: (c.value ?? '').slice(0,12) + '…' }));
  return NextResponse.json({ sessionUser: session?.user ?? null, cookies: cookieDump });
}








