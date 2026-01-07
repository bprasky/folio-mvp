'use server';

import { prisma } from '@/lib/prisma';

/**
 * Ensure a default "Unsorted" room exists for a project
 * This is a fallback room for images that don't have an explicit room assignment
 * Runs for ALL projects regardless of intent or living flags
 */
export async function ensureDefaultRoomForProject(projectId: string): Promise<{ id: string; name: string }> {
  // Find existing "Unsorted" room (case-insensitive)
  const existingRoom = await prisma.room.findFirst({
    where: {
      projectId,
      name: {
        equals: 'Unsorted',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (existingRoom) {
    return existingRoom;
  }

  // Create default room
  const newRoom = await prisma.room.create({
    data: {
      projectId,
      name: 'Unsorted',
      type: null, // No specific type for unsorted
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`[ensureDefaultRoomForProject] Created default room for project ${projectId}: ${newRoom.id}`);
  return newRoom;
}





