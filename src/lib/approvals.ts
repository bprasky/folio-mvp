'use server';

import { prisma } from '@/lib/prisma';
import {
  normalizeRoomName,
  extractRoomsFromText,
  computeRoomReadiness,
  CONCEPT_IMAGE_MARKER,
  isVerifiableApprovalType,
  type RoomWithReadiness,
  type RoomReadiness,
  type PendingApproval,
} from '@/lib/approvals-utils';

// Re-export types for convenience (server actions can re-export types)
export type { RoomWithReadiness, PendingApproval, RoomReadiness } from '@/lib/approvals-utils';

/**
 * Get all rooms with computed readiness for a project
 */
export async function getProjectRoomsWithReadiness(projectId: string): Promise<RoomWithReadiness[]> {
  const rooms = await prisma.room.findMany({
    where: { projectId },
    include: {
      noteAttachments: true,
      selections: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get images and skeletons per room
  const images = await prisma.projectImage.findMany({
    where: { projectId },
    select: { id: true, room: true, tags: { select: { id: true } } },
  });

  const skeletons = await prisma.skeletonItem.findMany({
    where: { projectId },
    select: { id: true, roomName: true },
  });

  return rooms.map(room => {
    // Count images that match this room (by room name or room field)
    const roomImages = images.filter(img => 
      img.room?.toLowerCase() === room.name.toLowerCase()
    );
    const imageCount = roomImages.length;
    const tagCount = roomImages.reduce((sum, img) => sum + img.tags.length, 0);
    
    // Count skeletons that match this room
    const skeletonCount = skeletons.filter(s => 
      s.roomName?.toLowerCase() === room.name.toLowerCase()
    ).length;
    
    const noteCount = room.noteAttachments.length;

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      readiness: computeRoomReadiness({ noteCount, skeletonCount, imageCount, tagCount }),
      noteCount,
      skeletonCount,
      imageCount,
      tagCount,
    };
  });
}

/**
 * Get pending approvals for a project
 * HARDENED: Only returns executable actions that Folio can complete and verify
 * 
 * Trust contract:
 * - Each approval has a working endpoint
 * - Each approval has a guaranteed UI outcome after execution
 * - Completion is verifiable (state changes remove the approval)
 */
export async function getProjectApprovals(projectId: string): Promise<PendingApproval[]> {
  const approvals: PendingApproval[] = [];

  // Get project with rooms, notes, images, skeletons, and tags
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      rooms: {
        include: {
          noteAttachments: true,
        },
      },
      meetingNotes: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          rawText: true,
          createdAt: true,
        },
      },
      images: {
        select: { 
          id: true, 
          room: true,
          name: true,  // For concept image detection
          tags: { select: { id: true } },  // For tag count
        },
      },
      post: {
        select: { id: true, status: true },
      },
    },
  });

  if (!project) return approvals;

  // Normalize existing room names for comparison
  const existingRoomNames = new Set(
    project.rooms.map(r => normalizeRoomName(r.name).toLowerCase())
  );

  // Get all skeletons for this project (batch query for performance)
  const allSkeletons = await prisma.skeletonItem.findMany({
    where: { projectId },
    select: { id: true, roomName: true },
  });

  // Build a map of room -> skeleton count
  const skeletonsByRoom = new Map<string, number>();
  for (const skeleton of allSkeletons) {
    const key = skeleton.roomName?.toLowerCase() || '';
    skeletonsByRoom.set(key, (skeletonsByRoom.get(key) || 0) + 1);
  }

  // 1) CREATE_ROOM approvals from meeting notes
  // Only suggest rooms that don't exist yet
  for (const note of project.meetingNotes) {
    if (!note.rawText) continue;
    
      const extractedRooms = extractRoomsFromText(note.rawText);
      
      for (const { roomType, roomName, excerpt } of extractedRooms) {
        const normalizedName = normalizeRoomName(roomName).toLowerCase();
        
        // Skip if room already exists
        if (existingRoomNames.has(normalizedName)) continue;
        
        // Skip if we already have an approval for this room
        const existingApproval = approvals.find(
          a => a.type === 'CREATE_ROOM' && 
               normalizeRoomName(a.payload.roomName as string).toLowerCase() === normalizedName
        );
        if (existingApproval) continue;
      
      approvals.push({
        id: `create-room-${roomType}-${note.id}`,
        type: 'CREATE_ROOM',
        title: `Create ${roomName} room`,
        description: `Mentioned in meeting notes but not yet created`,
        source: {
          noteId: note.id,
          noteTitle: note.title,
          excerpt,
          timestamp: note.createdAt,
        },
        payload: { roomName, roomType },
      });
    }
  }

  // 2) GENERATE_SKELETONS - Room-first doctrine
  // Show if room exists AND skeleton count == 0 AND (has note attachments OR has images)
  // This allows rooms created from notes to get skeletons even before media exists
  for (const room of project.rooms) {
    const roomNameLower = room.name.toLowerCase();
    const roomImages = project.images.filter(
      img => img.room?.toLowerCase() === roomNameLower
    );
    const skeletonCount = skeletonsByRoom.get(roomNameLower) || 0;
    const hasNoteAttachments = room.noteAttachments.length > 0;
    
    // Room-first: show if room has no skeletons AND (has notes OR has images)
    // This prevents spam for empty rooms with no context
    if (skeletonCount === 0 && (hasNoteAttachments || roomImages.length > 0)) {
      const contextSource = roomImages.length > 0 
        ? `${roomImages.length} image(s) ready for product detection`
        : 'Room created from notes — generate scaffolding';
      
      approvals.push({
        id: `generate-skeletons-${room.id}`,
        type: 'GENERATE_SKELETONS',
        title: `Detect products in ${room.name}`,
        description: contextSource,
        payload: { 
          roomId: room.id, 
          roomName: room.name, 
          imageCount: roomImages.length,
          hasNoteContext: hasNoteAttachments,
        },
      });
    }
  }

  // 3) GENERATE_CONCEPT_IMAGE
  // Show if room is STRUCTURED (has skeletons) and has no concept images
  // Changed: allow even if room has real photos — concept images are a separate asset
  for (const room of project.rooms) {
    const roomNameLower = room.name.toLowerCase();
    const skeletonCount = skeletonsByRoom.get(roomNameLower) || 0;
    
    // DEMO HEURISTIC: Check for existing concept images by filename convention
    // See CONCEPT_IMAGE_MARKER constant for documentation
    const hasConceptImage = project.images.some(
      img => img.room?.toLowerCase() === roomNameLower && 
             img.name?.includes(CONCEPT_IMAGE_MARKER)
    );
    
    // Show if room has skeletons (structured) but no concept image generated yet
    if (skeletonCount > 0 && !hasConceptImage) {
      approvals.push({
        id: `generate-concept-${room.id}`,
        type: 'GENERATE_CONCEPT_IMAGE',
        title: `Generate concept image for ${room.name}`,
        description: `Create AI visualization from ${skeletonCount} detected product(s)`,
        payload: { roomId: room.id, roomName: room.name, skeletonCount },
      });
    }
  }

  // 4) EDITORIAL - Separate DRAFT and PUBLISH approvals
  // Draft: creates editorial draft, navigates to PublishWorkflow
  // Publish: only shows when draft exists and is ready
  const totalTags = project.images.reduce((sum, img) => sum + img.tags.length, 0);
  const hasDraft = project.post && project.post.status === 'DRAFT';
  const isPublished = project.post && project.post.status === 'PUBLISHED';
  
  // DRAFT_EDITORIAL: Only if project has at least 1 tagged item AND no draft exists
  if (totalTags > 0 && !project.post) {
    approvals.push({
      id: `draft-editorial-${projectId}`,
      type: 'DRAFT_EDITORIAL',
      title: 'Create editorial draft',
      description: `${totalTags} tagged product(s) ready for editorial`,
      payload: { projectId, tagCount: totalTags },
    });
  }
  
  // PUBLISH_EDITORIAL: Only if draft exists and not yet published
  if (hasDraft && !isPublished) {
    approvals.push({
      id: `publish-editorial-${projectId}`,
      type: 'PUBLISH_EDITORIAL',
      title: 'Publish editorial',
      description: 'Draft ready — publish to share with the community',
      payload: { projectId, postId: project.post!.id },
    });
  }

  // 5) TAGGABLE_ITEMS_READY - Aggregated action item for taggable skeletons
  // Lower threshold in dev/demo for better visibility
  const MIN_TAGGABLE = process.env.NODE_ENV !== 'production' ? 1 : 3;
  const taggableSummary = await getTaggableSkeletonSummary(projectId);
  
  if (taggableSummary.total >= MIN_TAGGABLE) {
    const roomCount = taggableSummary.byRoom.length;
    
    approvals.push({
      id: `taggable-items-${projectId}`,
      type: 'TAGGABLE_ITEMS_READY',
      title: 'Items detected and ready to tag',
      description: `We found ${taggableSummary.total} items across ${roomCount} room${roomCount !== 1 ? 's' : ''}. Tagging unlocks affiliate credit, instant recall, and publish-ready callouts.`,
      payload: {
        projectId,
        total: taggableSummary.total,
        byRoom: taggableSummary.byRoom,
        topRoomName: taggableSummary.topRoomName,
      },
    });
  }

  // DEFENSIVE: Deduplicate approvals by ID
  // Prevents visual duplication if notes are edited/re-saved or data has edge cases
  const seenIds = new Set<string>();
  const deduplicatedApprovals = approvals.filter(approval => {
    if (seenIds.has(approval.id)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[getProjectApprovals] Duplicate approval filtered:', approval.id);
      }
      return false;
    }
    seenIds.add(approval.id);
    return true;
  });

  return deduplicatedApprovals;
}

/**
 * Get summary of taggable skeleton items for a project
 * Taggable = UNCONFIRMED or CONFIRMED status AND not linked to a product (confirmedProductId is null)
 */
export async function getTaggableSkeletonSummary(projectId: string): Promise<{
  total: number;
  byRoom: Array<{ roomId: string | null; roomName: string; count: number }>;
  topRoomName?: string;
}> {
  // Fetch taggable skeletons (UNCONFIRMED or CONFIRMED, not linked to product)
  const taggableSkeletons = await prisma.skeletonItem.findMany({
    where: {
      projectId,
      status: { in: ['UNCONFIRMED', 'CONFIRMED'] },
      confirmedProductId: null, // Not yet linked to a product
    },
    select: {
      id: true,
      roomName: true,
      projectImage: {
        select: {
          room: true,
        },
      },
    },
  });

  if (taggableSkeletons.length === 0) {
    return {
      total: 0,
      byRoom: [],
    };
  }

  // Collect all room names/IDs that need lookup
  const roomNamesToLookup = new Set<string>();
  const roomIdsToLookup = new Set<string>();
  
  for (const skeleton of taggableSkeletons) {
    if (skeleton.roomName) {
      roomNamesToLookup.add(skeleton.roomName);
    }
    if (skeleton.projectImage.room) {
      const roomValue = skeleton.projectImage.room;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomValue);
      if (isUuid) {
        roomIdsToLookup.add(roomValue);
      } else {
        roomNamesToLookup.add(roomValue);
      }
    }
  }

  // Batch lookup all rooms by name and ID
  const allRooms = await prisma.room.findMany({
    where: {
      projectId,
      OR: [
        { id: { in: Array.from(roomIdsToLookup) } },
        { name: { in: Array.from(roomNamesToLookup), mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  // Build lookup maps
  const roomIdToName = new Map<string, string>();
  const roomNameToId = new Map<string, string>();
  for (const room of allRooms) {
    roomIdToName.set(room.id, room.name);
    roomNameToId.set(room.name.toLowerCase(), room.id);
  }

  // Group by room (track both ID and name for deep-linking)
  const roomCounts = new Map<string, { roomId: string | null; roomName: string; count: number }>();
  
  for (const skeleton of taggableSkeletons) {
    let roomName: string | null = skeleton.roomName;
    let roomId: string | null = null;
    
    // If no roomName, try to get from image's room field
    if (!roomName && skeleton.projectImage.room) {
      const roomValue = skeleton.projectImage.room;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomValue);
      
      if (isUuid) {
        roomId = roomValue;
        roomName = roomIdToName.get(roomValue) || null;
      } else {
        roomName = roomValue;
        roomId = roomNameToId.get(roomValue.toLowerCase()) || null;
      }
    } else if (roomName) {
      // roomName exists, try to find room ID
      roomId = roomNameToId.get(roomName.toLowerCase()) || null;
    }
    
    // Use "Unsorted" as fallback if still no room name
    const key = roomName || 'Unsorted';
    const existing = roomCounts.get(key) || { roomId: null, roomName: key, count: 0 };
    roomCounts.set(key, {
      roomId: existing.roomId || roomId,
      roomName: key,
      count: existing.count + 1,
    });
  }

  // Convert to array and sort by count descending, take top 3
  const byRoom = Array.from(roomCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const total = taggableSkeletons.length;
  const topRoomName = byRoom.length > 0 ? byRoom[0].roomName : undefined;

  return {
    total,
    byRoom,
    topRoomName,
  };
}

// Note: getEditorialHint is a pure utility function, not a server action
// Import it directly from '@/lib/approvals-utils' where needed

/**
 * Get recent meeting notes for overview
 */
export async function getRecentNotes(projectId: string, limit = 3) {
  return prisma.meetingNote.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      attachments: {
        include: {
          room: { select: { id: true, name: true } },
        },
      },
    },
  });
}

