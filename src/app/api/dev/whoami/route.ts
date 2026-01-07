import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { cookies } from 'next/headers';

export async function GET() {
  const jar = cookies();
  const cookieNames = (jar.getAll?.() ?? []).map(c => c.name);

  const session = await getServerSession(authOptions);

  return NextResponse.json({
    nextAuthUserId: session?.user?.id ?? null,
    nextAuthUserRole: session?.user?.role ?? null,
    nextAuthUserEmail: session?.user?.email ?? null,
    cookieNames,
  });
} 