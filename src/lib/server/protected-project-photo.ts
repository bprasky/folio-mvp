import { prisma } from '@/lib/prisma';
import { parseProtectedPhotoUrl } from '@/lib/files/projectPhotoUrl';

export const PRIVATE_PHOTO_BUCKET = process.env.FOLIO_PRIVATE_PHOTOS_BUCKET || 'project-photos';

export async function downloadProjectPhotoObject(path: string) {
  const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
  const { data, error } = await supabaseAdmin.storage.from(PRIVATE_PHOTO_BUCKET).download(path);
  if (error || !data) throw new Error('Project photo unavailable.');
  if (data.size > 20 * 1024 * 1024) throw new Error('Project photo exceeds the processing limit.');
  return { buffer: Buffer.from(await data.arrayBuffer()), mime: data.type || 'image/jpeg' };
}

/** Trusted processing/export callers must supply the project they authorized.
 * No signed bearer URL is sent to a browser or stored in project content. */
export async function readProtectedProjectPhoto(url: string, authorizedProjectId: string) {
  const object = parseProtectedPhotoUrl(url);
  if (!object) return null;
  if (object.projectId !== authorizedProjectId) throw new Error('Photo does not belong to the authorized project.');
  const image = await prisma.projectImage.findFirst({ where: { projectId: authorizedProjectId, url }, select: { id: true } });
  const crop = image ? null : await prisma.productTag.findFirst({ where: { cropUrl: url, image: { projectId: authorizedProjectId } }, select: { id: true } });
  if (!image && !crop) throw new Error('Project photo no longer exists.');
  return downloadProjectPhotoObject(object.path);
}

/** Short-lived provider access, only for a previously authorized project job.
 * Already-issued links remain usable for at most 60 seconds after withdrawal. */
export async function projectPhotoProcessingUrl(url: string, authorizedProjectId: string) {
  const object = parseProtectedPhotoUrl(url);
  if (!object) return url;
  if (object.projectId !== authorizedProjectId || !await prisma.projectImage.findFirst({
    where: { projectId: authorizedProjectId, url }, select: { id: true },
  })) throw new Error('Project photo no longer exists.');
  const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
  const { data, error } = await supabaseAdmin.storage.from(PRIVATE_PHOTO_BUCKET).createSignedUrl(object.path, 60);
  if (error || !data) throw new Error('Project photo unavailable for processing.');
  return data.signedUrl;
}
