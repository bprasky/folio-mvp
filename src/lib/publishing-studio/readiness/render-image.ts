import { readProtectedProjectPhoto } from '@/lib/server/protected-project-photo';
import 'server-only';
import sharp from 'sharp';
import { renderPublicationPhoto } from '@/lib/instagram-export/render-publication-photo';
import type { PublicationPhoto } from '@/lib/instagram-export/publication-photo';

/** Read only reviewed first-party storage images, with bounded fetch and decoding. */
export async function renderApprovedImage(source: string, width: number, height: number, projectId?: string, presentation?: PublicationPhoto): Promise<Buffer> {
  const protectedImage = projectId ? await readProtectedProjectPhoto(source, projectId) : null;
  if (protectedImage) return presentation ? renderPublicationPhoto(protectedImage.buffer, presentation, width, height)
    : sharp(protectedImage.buffer, { limitInputPixels: 40_000_000 }).rotate().resize(width, height, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
  const url = new URL(source);
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!origin || url.origin !== new URL(origin).origin || url.protocol !== 'https:' || !url.pathname.startsWith('/storage/v1/object/public/')) {
    throw new Error('This image needs a new source review.');
  }
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw new Error('A source image is unavailable.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 15_000_000) throw new Error('This image exceeds the export limit.');
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  const buffer = Buffer.concat(chunks);
  return presentation ? renderPublicationPhoto(buffer, presentation, width, height)
    : sharp(buffer, { limitInputPixels: 50_000_000 }).rotate().resize(width, height, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
}
