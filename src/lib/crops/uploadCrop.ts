import { prisma } from '@/lib/prisma';
import { saveBufferToProjectStorage } from '@/lib/storage';

export interface UploadCropResult { bucket: string; path: string; publicUrl: string }

export async function uploadCrop({ buffer, tagId, projectId, expected, metadata }: {
  buffer: Buffer; tagId: string; projectId: string;
  expected: { imageId: string; x: number; y: number; updatedAt: Date };
  metadata: { cropX: number; cropY: number; cropScale: number; cropAspect: string; cropManual?: boolean };
}): Promise<UploadCropResult> {
  // Immutable private derivatives follow the source photo's current visibility.
  const stored = await saveBufferToProjectStorage({ projectId, roomId: 'crops/' + tagId + '/v2', buffer, mime: 'image/png' });
  // A completed derivative must still belong to the exact source snapshot.
  // In particular, never attach bytes from an excluded photo to a moved tag.
  const changed = await prisma.productTag.updateMany({
    where: { id: tagId, image: { projectId }, ...expected },
    data: { ...metadata, cropUrl: stored.publicUrl },
  });
  if (changed.count !== 1) throw Object.assign(new Error('This tag changed while its crop was being made. Refresh and try again.'), { status: 409 });
  return stored;
}
