import { createRoomOnce } from '@/lib/projects/createRoom';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from "zod";
import { assertProjectView, assertProjectWrite } from "@/lib/authz/access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: projectId } = params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await assertProjectWrite(session.user.id, projectId);
    const room = await createRoomOnce(session.user.id, params.id, await request.json());

    return NextResponse.json(room);
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'A valid room name and stable request ID are required.' }, { status: 400 });
    if (error instanceof Error && ['Forbidden', 'NotFound'].includes(error.message)) return NextResponse.json({ error: error.message }, { status: error.message === 'Forbidden' ? 403 : 404 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (error instanceof Error && error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message === "NotFound") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await assertProjectView(session.user.id, projectId);

    const rooms = await prisma.room.findMany({
      where: { projectId },
      include: {
        selections: {
          include: {
            vendorRep: { select: { id: true, name: true, companyName: true } },
            quotes: true,
          },
        },
        quotes: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(rooms);
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 409) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'A valid room name and stable request ID are required.' }, { status: 400 });
    if (error instanceof Error && ['Forbidden', 'NotFound'].includes(error.message)) return NextResponse.json({ error: error.message }, { status: error.message === 'Forbidden' ? 403 : 404 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    if (error instanceof Error && error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message === "NotFound") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
} 