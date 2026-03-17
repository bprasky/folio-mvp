'use server';

import { prisma } from '@/lib/prisma';
import { normalizeRoomName, normalizeRoomKey } from '@/lib/approvals-utils';

/**
 * Ensure a room exists for a project by name
 * Deduplicates by normalized key (case-insensitive, trimmed)
 * Returns the Room record (existing or newly created)
 */
export async function ensureRoomByName(
  projectId: string,
  rawRoomName: string
): Promise<{ id: string; name: string; type: string | null }> {
  if (!rawRoomName || !rawRoomName.trim()) {
    throw new Error('Room name is required');
  }

  // Normalize to display name and dedupe key
  const displayName = normalizeRoomName(rawRoomName);
  const dedupeKey = normalizeRoomKey(displayName);

  // Find existing room by case-insensitive name match
  const existingRoom = await prisma.room.findFirst({
    where: {
      projectId,
      name: {
        equals: displayName,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  if (existingRoom) {
    return existingRoom;
  }

  // Infer room type from name if possible
  const roomType = inferRoomType(displayName);

  // Create new room
  const newRoom = await prisma.room.create({
    data: {
      projectId,
      name: displayName,
      type: roomType,
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  return newRoom;
}

/**
 * Infer room type from room name
 * Returns a room type string or null
 */
export function inferRoomType(roomName: string): string | null {
  const lower = roomName.toLowerCase();
  
  if (lower.includes('kitchen')) return 'KITCHEN';
  if (lower.includes('bath') || lower.includes('powder')) return 'BATH';
  if (lower.includes('living') || lower.includes('family')) return 'LIVING';
  if (lower.includes('bedroom') || lower.includes('bed') || lower.includes('nursery')) return 'BEDROOM';
  if (lower.includes('dining')) return 'DINING';
  if (lower.includes('office') || lower.includes('study')) return 'OFFICE';
  if (lower.includes('entry') || lower.includes('foyer') || lower.includes('mudroom')) return 'ENTRY';
  
  return null;
}





