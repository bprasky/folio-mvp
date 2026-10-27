import { z } from 'zod';
import { createRoomOnce } from '@/lib/projects/createRoom';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView, assertProjectWrite } from '@/lib/authz/access';

export async function GET(_req: Request, { params }: { params: { id: string }}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.id);

    const rooms = await prisma.room.findMany({
      where: { projectId: params.id as any },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({ rooms });
  } catch (e) {
    console.warn("[Rooms GET] failed:", (e as any)?.message);
    return NextResponse.json({ rooms: [] });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertProjectWrite(session.user.id, params.id);

    const projectId = params.id;
    const room = await createRoomOnce(session.user.id, params.id, await request.json());

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'A valid room name and stable request ID are required.' }, { status: 400 });
    if (error instanceof Error && ['Forbidden', 'NotFound'].includes(error.message)) return NextResponse.json({ error: error.message }, { status: error.message === 'Forbidden' ? 403 : 404 });
    console.error('Error creating vendor project room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
} 