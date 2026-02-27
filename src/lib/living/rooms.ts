import { prisma } from "@/lib/prisma";
import { ProjectTimeline } from "@prisma/client";
import { ensureDefaultRoomForProject } from './defaultRoom';
import { formatRoomName } from '@/lib/utils/formatRoomName';

const NEXT_PUBLIC_FOLIO_LIVING_PROJECTS = process.env.NEXT_PUBLIC_FOLIO_LIVING_PROJECTS === 'true';
const NEXT_PUBLIC_FOLIO_SKELETON_TAGS = process.env.NEXT_PUBLIC_FOLIO_SKELETON_TAGS === 'true';

/**
 * Ensures Room rows exist for a project based on ProjectImage.room values.
 * Always ensures a default "Unsorted" room exists.
 * Living-specific room inference only runs for PAST projects with living/skeleton flags enabled.
 */
export async function ensureRoomsForProject(projectId: string): Promise<void> {
  // ALWAYS ensure default room exists (regardless of flags)
  try {
    await ensureDefaultRoomForProject(projectId);
  } catch (error) {
    console.error(`[ensureRoomsForProject] Failed to ensure default room:`, error);
    // Continue even if default room creation fails
  }

  // Early return if living features are disabled
  if (!NEXT_PUBLIC_FOLIO_LIVING_PROJECTS || !NEXT_PUBLIC_FOLIO_SKELETON_TAGS) {
    return; // Default room already created above
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        intent: true,
        livingEnabled: true,
        livingOptOut: true,
        images: {
          select: {
            room: true,
          },
        },
        rooms: {
          select: {
            name: true,
          },
        },
        skeletonItems: {
          select: {
            roomName: true,
          },
          where: {
            status: { in: ['UNCONFIRMED', 'CONFIRMED'] },
          },
        },
      },
    });

    if (!project) {
      console.warn(`[ensureRoomsForProject] Project ${projectId} not found`);
      return; // Default room already created above
    }

    // Only run living-specific inference for PAST projects with living enabled
    if (project.intent !== ProjectTimeline.PAST || !project.livingEnabled || project.livingOptOut) {
      return; // Default room already created above
    }

    // Collect distinct room names from images (non-null, non-empty)
    const imageRoomNames = new Set<string>();
    project.images.forEach((img) => {
      if (img.room && img.room.trim()) {
        imageRoomNames.add(img.room.trim());
      }
    });

    // Collect distinct room names from skeletons (non-null, non-empty)
    const skeletonRoomNames = new Set<string>();
    project.skeletonItems.forEach((skeleton) => {
      if (skeleton.roomName && skeleton.roomName.trim()) {
        skeletonRoomNames.add(skeleton.roomName.trim());
      }
    });

    // Merge both sets (union) - prefer image room names if conflict exists
    // Human-assigned (image.room) takes precedence over AI-detected (skeleton.roomName)
    const allRoomNames = new Set([...imageRoomNames, ...skeletonRoomNames]);

    // Get existing room names
    const existingRoomNames = new Set(project.rooms.map((r) => r.name));

    // Find rooms that need to be created
    const roomsToCreate = Array.from(allRoomNames).filter(
      (name) => !existingRoomNames.has(name)
    );

    // If no rooms exist at all, create a default "General" room
    if (project.rooms.length === 0 && allRoomNames.size === 0) {
      roomsToCreate.push("General");
    }

    // Create missing rooms
    if (roomsToCreate.length > 0) {
      await prisma.room.createMany({
        data: roomsToCreate.map((name) => ({
          name: formatRoomName(name),
          projectId,
        })),
        skipDuplicates: true,
      });
      console.log(
        `[ensureRoomsForProject] Created ${roomsToCreate.length} rooms for project ${projectId}: ${roomsToCreate.join(", ")}`
      );
    }
  } catch (error) {
    console.error(`[ensureRoomsForProject] Error for project ${projectId}:`, error);
    // Don't throw - this is a non-critical helper
  }
}

