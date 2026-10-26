import { prisma } from '@/lib/prisma';

/** Keep linked selections with their photo, including Uncategorized (null). */
export async function updateImageRoom(projectId: string, imageId: string, roomId: string | null, inclusion?: 'INCLUDED', legacyRoom?: string | null) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`;
    if (roomId && !await tx.room.findFirst({ where: { id: roomId, projectId } })) throw new Error('Room not found for this project');
    const image = await tx.projectImage.update({ where: { id: imageId, projectId }, data: { roomId, ...(inclusion ? { inclusion } : {}), ...(legacyRoom !== undefined ? { room: legacyRoom } : {}) } });
    await tx.selection.updateMany({ where: { projectId, productTag: { imageId } }, data: { roomId, photo: image.url } });
    return image;
  });
}
