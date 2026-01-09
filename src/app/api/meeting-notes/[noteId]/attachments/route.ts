export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/meeting-notes/[noteId]/attachments
 * Add an attachment to a meeting note
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noteId } = params;
    const body = await request.json();
    const { type, id } = body as {
      type: 'project' | 'room' | 'productTag';
      id: string;
    };

    if (!type || !id) {
      return NextResponse.json(
        { error: 'type and id are required' },
        { status: 400 }
      );
    }

    // Verify note exists and user has access to its project
    const note = await prisma.meetingNote.findUnique({
      where: { id: noteId },
      include: { project: true },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Check project access
    if (note.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate attachment belongs to the same project
    if (type === 'room') {
      const room = await prisma.room.findFirst({
        where: { id, projectId: note.projectId },
      });
      if (!room) {
        return NextResponse.json(
          { error: 'Room not found in project' },
          { status: 400 }
        );
      }
    } else if (type === 'productTag') {
      const tag = await prisma.projectProductTag.findFirst({
        where: { id, projectId: note.projectId },
      });
      if (!tag) {
        return NextResponse.json(
          { error: 'Product tag not found in project' },
          { status: 400 }
        );
      }
    }

    // Check if attachment already exists
    const existing = await prisma.noteAttachment.findFirst({
      where: {
        noteId,
        ...(type === 'project' ? { projectId: id } : {}),
        ...(type === 'room' ? { roomId: id } : {}),
        ...(type === 'productTag' ? { productTagId: id } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Attachment already exists' },
        { status: 409 }
      );
    }

    // Create attachment
    const attachment = await prisma.noteAttachment.create({
      data: {
        noteId,
        ...(type === 'project' ? { projectId: id } : {}),
        ...(type === 'room' ? { roomId: id } : {}),
        ...(type === 'productTag' ? { productTagId: id } : {}),
      },
      include: {
        project: { select: { id: true, title: true } },
        room: { select: { id: true, name: true } },
        productTag: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('Error creating attachment:', error);
    return NextResponse.json(
      { error: 'Failed to create attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meeting-notes/[noteId]/attachments
 * Remove an attachment from a meeting note
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noteId } = params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json(
        { error: 'attachmentId is required' },
        { status: 400 }
      );
    }

    // Verify note exists and user has access
    const note = await prisma.meetingNote.findUnique({
      where: { id: noteId },
      include: { project: true },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Check project access
    if (note.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify attachment belongs to this note
    const attachment = await prisma.noteAttachment.findFirst({
      where: { id: attachmentId, noteId },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Delete attachment (note remains)
    await prisma.noteAttachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}








