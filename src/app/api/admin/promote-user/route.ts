import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

const ALLOWED = new Set(['ADMIN','VENDOR','DESIGNER','STUDENT','HOMEOWNER']);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = String(session?.user?.role || '').toUpperCase();
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, newRole } = await req.json().catch(() => ({}));
  if (!email || !newRole || !ALLOWED.has(String(newRole).toUpperCase())) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { email: String(email).trim().toLowerCase() },
    data: { role: String(newRole).toUpperCase() },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, user: updated });
}
