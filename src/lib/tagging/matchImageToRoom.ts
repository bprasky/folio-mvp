import { prisma } from '@/lib/prisma';

/**
 * Match a ProjectImage to a Room by comparing ProjectImage.room (string)
 * to Room.name (case-insensitive).
 *
 * Returns the Room record or null if no match.
 */
export async function matchImageToRoom(
  imageRoom: string | null | undefined,
  projectId: string
) {
  if (!imageRoom) return null;

  return prisma.room.findFirst({
    where: {
      projectId,
      name: { equals: imageRoom, mode: 'insensitive' },
    },
  });
}
