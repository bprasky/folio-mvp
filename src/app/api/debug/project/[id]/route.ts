export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizeRole, canAccessAdmin } from '@/lib/permissions';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  // Debug routes only available in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canAccessAdmin(normalizeRole(session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const core = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, ownerId: true, createdAt: true, updatedAt: true },
    });
    let designerId: string | null = null;
    try {
      const extra = (await prisma.project.findUnique({
        where: { id: params.id },
        // @ts-ignore
        select: { designerId: true },
      } as any)) as any;
      designerId = extra?.designerId ?? null;
    } catch {}
    return NextResponse.json({ exists: !!core, core, designerId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}


















