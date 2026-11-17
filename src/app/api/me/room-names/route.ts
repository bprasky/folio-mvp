import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cleanRoomName, roomNameKey } from '@/lib/rooms/roomNames';

export const dynamic = 'force-dynamic';
const input = z.object({ name: z.string().trim().min(1).max(120).refine(name => !/[\u0000-\u001f\u007f]/.test(name)) }).strict();
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
  try {
    const rows = await prisma.userRoomName.findMany({ where: { userId: session.user.id }, select: { name: true }, orderBy: { name: 'asc' } });
    return json({ names: rows.map(row => row.name) });
  } catch (error) {
    console.error('[room-names] read failed', error);
    return json({ error: 'Your saved room names could not be loaded.' }, 503);
  }
}

async function mutate(request: NextRequest, remove: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
  try {
    const name = cleanRoomName(input.parse(await request.json()).name);
    const userId = session.user.id;
    const normalizedName = roomNameKey(name);
    if (remove) {
      await prisma.userRoomName.deleteMany({ where: { userId, normalizedName } });
      return json({ ok: true });
    }
    // An atomic upsert keeps retries and two tabs from duplicating a saved name.
    const saved = await prisma.userRoomName.upsert({
      where: { userId_normalizedName: { userId, normalizedName } },
      create: { userId, normalizedName, name }, update: {}, select: { name: true },
    });
    return json(saved);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Enter a room name between 1 and 120 characters.' }, 400);
    console.error('[room-names] save failed', error);
    return json({ error: 'Your room name could not be saved. Try again.' }, 503);
  }
}

export async function POST(request: NextRequest) { return mutate(request, false); }
export async function DELETE(request: NextRequest) { return mutate(request, true); }
