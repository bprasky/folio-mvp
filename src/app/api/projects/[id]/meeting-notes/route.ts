import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { extractRoomsFromText, normalizeRoomName, MAX_AUTO_CREATE_ROOMS } from '@/lib/approvals-utils';

/**
 * GET /api/projects/[id]/meeting-notes
 * Returns all meeting notes for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch meeting notes with attachments
    const notes = await prisma.meetingNote.findMany({
      where: { projectId },
      include: {
        attachments: {
          include: {
            project: { select: { id: true, title: true } },
            room: { select: { id: true, name: true } },
            productTag: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        } as any, // Type will be available after prisma generate
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error fetching meeting notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meeting notes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/meeting-notes
 * Creates a new meeting note
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = params;
    const body = await request.json();
    const { sourceType, title, rawText, attachments } = body as {
      sourceType: string;
      title?: string;
      rawText?: string;
      attachments?: Array<{ type: 'project' | 'room' | 'productTag'; id: string }>;
    };

    if (!sourceType) {
      return NextResponse.json(
        { error: 'sourceType is required' },
        { status: 400 }
      );
    }

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate attachments if provided
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        // Validate that the attachment belongs to this project
        if (attachment.type === 'room') {
          const room = await prisma.room.findFirst({
            where: { id: attachment.id, projectId },
          });
          if (!room) {
            return NextResponse.json(
              { error: `Room ${attachment.id} not found in project` },
              { status: 400 }
            );
          }
        } else if (attachment.type === 'productTag') {
          const tag = await prisma.projectProductTag.findFirst({
            where: { id: attachment.id, projectId },
          });
          if (!tag) {
            return NextResponse.json(
              { error: `Product tag ${attachment.id} not found in project` },
              { status: 400 }
            );
          }
        }
        // project type is validated by projectId already
      }
    }

    // Create meeting note with attachments
    const note = await prisma.meetingNote.create({
      data: {
        projectId,
        sourceType,
        title: title || null,
        rawText: rawText || null,
        status: 'ready',
        attachments: attachments && attachments.length > 0 ? {
          create: attachments.map((att) => {
            if (att.type === 'project') {
              return { projectId: att.id };
            } else if (att.type === 'room') {
              return { roomId: att.id };
            } else {
              return { productTagId: att.id };
            }
          }),
        } : undefined,
      } as any, // Type will be available after prisma generate
      include: {
        attachments: {
          include: {
            project: { select: { id: true, title: true } },
            room: { select: { id: true, name: true } },
            productTag: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        } as any, // Type will be available after prisma generate
      },
    });

    // ROOM EXTRACTION: Auto-create rooms mentioned in note text
    // THROTTLED: Only auto-create up to MAX_AUTO_CREATE_ROOMS rooms per note
    // Additional rooms become Pending Approvals
    
    // Track auto-created rooms for client acknowledgment (trust reinforcement)
    let autoCreatedRooms: Array<{ name: string; type: string | null }> = [];
    let extractedRoomsCount = 0;
    
    if (rawText) {
      const extractedRooms = extractRoomsFromText(rawText);
      extractedRoomsCount = extractedRooms.length;
      
      if (extractedRooms.length > 0) {
        // Get existing rooms for this project
        const existingRooms = await prisma.room.findMany({
          where: { projectId },
          select: { id: true, name: true },
        });
        
        // Normalize existing room names for comparison
        const existingRoomNamesNormalized = new Set(
          existingRooms.map(r => normalizeRoomName(r.name).toLowerCase())
        );

        // Filter to only missing rooms
        const missingRooms = extractedRooms.filter(
          ({ roomName }) => !existingRoomNamesNormalized.has(normalizeRoomName(roomName).toLowerCase())
        );

        // THROTTLE: Only auto-create up to MAX_AUTO_CREATE_ROOMS
        // The rest will appear as Pending Approvals in the Overview
        const roomsToAutoCreate = missingRooms.slice(0, MAX_AUTO_CREATE_ROOMS);
        const roomsForApprovals = missingRooms.slice(MAX_AUTO_CREATE_ROOMS);
        
        if (roomsForApprovals.length > 0 && process.env.NODE_ENV === 'development') {
          console.log('[meeting-notes] Throttled room creation:', {
            autoCreated: roomsToAutoCreate.map(r => r.roomName),
            deferredToApprovals: roomsForApprovals.map(r => r.roomName),
          });
        }

        // Auto-create throttled set of rooms
        for (const { roomName, roomType } of roomsToAutoCreate) {
          const normalizedName = normalizeRoomName(roomName);
          
          // Double-check room doesn't exist (normalized comparison)
          let room = existingRooms.find(
            r => normalizeRoomName(r.name).toLowerCase() === normalizedName.toLowerCase()
          );
          
          if (!room) {
            // Auto-create the room
            const newRoom = await prisma.room.create({
              data: {
                name: normalizedName,
                type: roomType,
                projectId,
              },
            });
            room = newRoom;
            existingRooms.push(newRoom); // Add to local cache
            
            // Track for client acknowledgment (trust reinforcement)
            autoCreatedRooms.push({ name: normalizedName, type: roomType });
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[meeting-notes] Auto-created room from note:', {
                roomName: normalizedName,
                roomType,
                noteId: note.id,
              });
            }
          }

          // Create attachment linking note to room
          const existingAttachment = await prisma.noteAttachment.findFirst({
            where: {
              noteId: note.id,
              roomId: room.id,
            },
          });

          if (!existingAttachment) {
            await prisma.noteAttachment.create({
              data: {
                noteId: note.id,
                roomId: room.id,
              },
            });
          }
        }

        // Also link existing rooms mentioned in note
        for (const { roomName } of extractedRooms) {
          const normalizedName = normalizeRoomName(roomName);
          const room = existingRooms.find(
            r => normalizeRoomName(r.name).toLowerCase() === normalizedName.toLowerCase()
          );
          
          if (room) {
            const existingAttachment = await prisma.noteAttachment.findFirst({
              where: {
                noteId: note.id,
                roomId: room.id,
              },
            });

            if (!existingAttachment) {
              await prisma.noteAttachment.create({
                data: {
                  noteId: note.id,
                  roomId: room.id,
                },
              });
            }
          }
        }
      }
    }

    // Refetch note with updated attachments
    const updatedNote = await prisma.meetingNote.findUnique({
      where: { id: note.id },
      include: {
        attachments: {
          include: {
            project: { select: { id: true, title: true } },
            room: { select: { id: true, name: true } },
            productTag: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        } as any,
      },
    });

    // Return note with metadata about system actions taken
    // autoCreatedRooms enables client-side acknowledgment toasts (trust reinforcement)
    return NextResponse.json({
      ...updatedNote,
      _meta: {
        autoCreatedRooms,
        linkedRoomCount: extractedRoomsCount,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating meeting note:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting note' },
      { status: 500 }
    );
  }
}




