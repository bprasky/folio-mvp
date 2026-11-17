import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** Caller holds the project lock, including when room sorting is part of photo approval. */
export async function updateImageRoomInTransaction(tx: Prisma.TransactionClient, projectId: string, imageId: string, roomId: string | null, inclusion?: 'INCLUDED', legacyRoom?: string | null) {
  if (roomId && !await tx.room.findFirst({ where: { id: roomId, projectId } })) throw new Error('Room not found for this project');
  const image = await tx.projectImage.update({ where: { id: imageId, projectId }, data: { roomId, ...(inclusion ? { inclusion } : {}), ...(legacyRoom !== undefined ? { room: legacyRoom } : {}) } });
  await tx.selection.updateMany({ where: { projectId, productTag: { imageId } }, data: { roomId, photo: image.url } });
  return image;
}

/** Keep linked selections with their photo, including Uncategorized (null). */
export async function updateImageRoom(projectId: string, imageId: string, roomId: string | null, inclusion?: 'INCLUDED', legacyRoom?: string | null) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
    return updateImageRoomInTransaction(tx, projectId, imageId, roomId, inclusion, legacyRoom);
  });
}
