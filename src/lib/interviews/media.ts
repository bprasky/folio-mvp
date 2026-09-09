import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { INTERVIEW_MIME, MAX_INTERVIEW_BYTES } from './format';
import type { MediaAsset } from '@prisma/client';

export const MEDIA_TTL_SECONDS = 300;
export function mediaBucket() {
  const bucket = process.env.INTERVIEW_MEDIA_BUCKET;
  if (bucket !== 'interview-media') throw new Error('Interview media storage is not configured');
  return bucket;
}
// Lightweight EBML header/DocType check, not a codec decoder.
export function isWebM(bytes: Uint8Array): boolean {
  const header = Buffer.from(bytes.subarray(0, 4096));
  return header.length > 12 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    && header.includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]));
}
export function objectKey(interviewId: string, asset: Pick<MediaAsset, 'storageKey' | 'metadata' | 'mimeType'>) {
  const metadata = asset.metadata as { bucket?: string } | null;
  const prefix = `interviews/${interviewId}/`;
  if (metadata?.bucket !== mediaBucket() || asset.mimeType !== INTERVIEW_MIME
    || !asset.storageKey.startsWith(prefix)
    || !/^[0-9a-f-]{36}\.webm$/.test(asset.storageKey.slice(prefix.length))) throw new Error('Invalid interview media reference');
  return asset.storageKey;
}
export async function removeMedia(key: string) {
  try {
    const { error } = await supabaseAdmin.storage.from(mediaBucket()).remove([key]);
    if (error) throw error;
  } catch { console.warn('[interview-media] orphan-cleanup-failed'); }
}
export async function signedMedia(interviewId: string, asset: MediaAsset) {
  const { data, error } = await supabaseAdmin.storage.from(mediaBucket()).createSignedUrl(objectKey(interviewId, asset), MEDIA_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error('Media access unavailable');
  return data.signedUrl;
}
export async function downloadMedia(interviewId: string, asset: MediaAsset) {
  const { data, error } = await supabaseAdmin.storage.from(mediaBucket()).download(objectKey(interviewId, asset));
  if (error || !data || !data.size || data.size > MAX_INTERVIEW_BYTES) throw new Error('Media download failed');
  const bytes = await data.arrayBuffer();
  if (!isWebM(new Uint8Array(bytes))) throw new Error('Invalid media');
  return new File([bytes], 'recording.webm', { type: INTERVIEW_MIME });
}
