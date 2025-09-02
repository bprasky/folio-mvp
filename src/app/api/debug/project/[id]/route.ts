import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: { id: string } }) {
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

