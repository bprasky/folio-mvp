import { z } from 'zod';
import { createRoomOnce } from '@/lib/projects/createRoom';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assertProjectView, assertProjectWrite } from '@/lib/authz/access';
import { MOCK_PROJECTS } from '@/lib/mock/designer';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await assertProjectView(session.user.id, params.id);

    const { id: projectId } = params;

    // Fetch real rooms from Prisma
    const rooms = await prisma.room.findMany({
      where: { 
        projectId
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    
    return NextResponse.json({ rooms });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'A valid room name and stable request ID are required.' }, { status: 400 });
    if (error instanceof Error && ['Forbidden', 'NotFound'].includes(error.message)) return NextResponse.json({ error: error.message }, { status: error.message === 'Forbidden' ? 403 : 404 });
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
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

    const room = await createRoomOnce(session.user.id, params.id, await request.json());

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'A valid room name and stable request ID are required.' }, { status: 400 });
    if (error instanceof Error && ['Forbidden', 'NotFound'].includes(error.message)) return NextResponse.json({ error: error.message }, { status: error.message === 'Forbidden' ? 403 : 404 });
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 