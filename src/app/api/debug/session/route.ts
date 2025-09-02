import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

export async function GET() {
  const s = await getServerSession(authOptions);
  return NextResponse.json({ session: s ? { user: s.user } : null });
}
