import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';

async function getUserId(req: Request) {
  const s = await getServerSession();
  if (s?.user?.id) return s.user.id;
  const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET }).catch(() => null);
  return (t?.sub as string) ?? null;
}

export async function GET(req: Request) {
  const id = await getUserId(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, id });
}