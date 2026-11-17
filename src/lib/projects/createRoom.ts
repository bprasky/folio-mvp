import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import { roomNameKey } from '@/lib/rooms/roomNames';

export const RoomCreationInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().max(120).nullable().optional(),
  requestId: z.string().regex(/^[a-zA-Z0-9-]{16,80}$/),
  reuseExisting: z.boolean().optional().default(false),
});

/** Call only after asserting current project write access. */
export async function createRoomOnce(actorId: string, projectId: string, raw: unknown) {
  const { name, type, requestId, reuseExisting } = RoomCreationInput.parse(raw);
  const id = requestIdentity('room-create', [actorId, projectId, requestId]);
  const replay = async () => {
    const room = await prisma.room.findUnique({ where: { id }, include: { selections: true } });
    if (room && (room.name !== name || room.type !== (type || null))) {
      throw Object.assign(new Error('This room request already saved different details. Refresh to edit the saved room.'), { status: 409 });
    }
    return room;
  };
  const existing = await replay();
  if (existing) return existing;
  if (reuseExisting) {
    return prisma.$transaction(async tx => {
      // Serialize name-based creation per project, including two tabs/users.
      // Access was checked by the caller before entering this transaction.
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
      const rooms = await tx.room.findMany({ where: { projectId }, include: { selections: true }, orderBy: { createdAt: 'asc' } });
      const matching = rooms.find(room => roomNameKey(room.name) === roomNameKey(name));
      if (matching) return matching;
      return tx.room.create({ data: { id, projectId, name, type: type || null }, include: { selections: true } });
    });
  }
  try {
    return await prisma.room.create({ data: { id, projectId, name, type: type || null }, include: { selections: true } });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const winner = await replay();
      if (winner) return winner;
    }
    throw error;
  }
}
