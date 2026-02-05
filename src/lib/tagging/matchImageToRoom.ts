import { prisma } from '@/lib/prisma';

/**
 * Match a ProjectImage to a Room by comparing:
 *   1. ProjectImage.room (string) to Room.name (case-insensitive)
 *   2. ProjectImage.aiSpaces (string[]) to Room.name (case-insensitive)
 *
 * Returns the Room record or null if no match.
 */
export async function matchImageToRoom(
  imageRoom: string | null | undefined,
  projectId: string,
  aiSpaces?: string[] | null
) {
  // Try direct room field first
  if (imageRoom) {
    const match = await prisma.room.findFirst({
      where: {
        projectId,
        name: { equals: imageRoom, mode: 'insensitive' },
      },
    });
    if (match) return match;
  }

  // Fallback: try AI-detected spaces
  if (aiSpaces && aiSpaces.length > 0) {
    for (const space of aiSpaces) {
      const match = await prisma.room.findFirst({
        where: {
          projectId,
          name: { equals: space, mode: 'insensitive' },
        },
      });
      if (match) return match;
    }
  }

  return null;
}
