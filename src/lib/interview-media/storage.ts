import 'server-only';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mediaBucket } from '@/lib/interviews/media';
import { MediaError, MAX_CHUNK_BYTES } from './types';

export async function assertCaptureStorageReady() {
  const { data, error } = await supabaseAdmin.storage.getBucket(mediaBucket());
  if (error || !data || data.public || (data.file_size_limit && Number(data.file_size_limit) < MAX_CHUNK_BYTES))
    throw new MediaError('Private recording storage is unavailable. Continue without recording.', 503);
  if (data.allowed_mime_types && !['audio/webm', 'video/webm', 'audio/mp4', 'video/mp4'].every(mime => data.allowed_mime_types!.includes(mime)))
    throw new MediaError('Private recording storage needs the supported audio/video formats enabled before recording.', 503);
}
export function storageKey(sessionId: string, runId: string, name: string) {
  if (![sessionId, runId].every(id => /^[a-zA-Z0-9_-]{1,100}$/.test(id)) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(name))
    throw new MediaError('Invalid storage reference.');
  return `live/${sessionId}/${runId}/${name}`;
}
export function assertStorageKey(key: string, sessionId: string, recordId: string) {
  if (!key.startsWith(storageKey(sessionId, recordId, 'x').slice(0, -1)) || key.includes('..') || key.includes('\\'))
    throw new MediaError('Invalid storage reference.');
}
export async function chunkUpload(key: string) {
  const { data, error } = await supabaseAdmin.storage.from(mediaBucket()).createSignedUploadUrl(key, { upsert: false });
  if (error || !data) throw new MediaError('Could not authorize this recording upload.', 503);
  return data;
}
export async function inspectChunk(key: string, bytes: number, mime: string) {
  const { data, error } = await supabaseAdmin.storage.from(mediaBucket()).info(key);
  const info = data as unknown as { size?: number; contentType?: string; metadata?: { size?: number; mimetype?: string } } | null;
  if (error || !info || Number(info.size ?? info.metadata?.size) !== bytes ||
    (info.contentType ?? info.metadata?.mimetype)?.split(';')[0] !== mime.split(';')[0])
    throw new MediaError('The uploaded recording chunk is missing or does not match its reservation.', 409);
}
export async function signedPrivate(key: string, seconds = 120) {
  const { data, error } = await supabaseAdmin.storage.from(mediaBucket()).createSignedUrl(key, seconds);
  if (error || !data) throw new MediaError('Private playback is unavailable.', 503);
  return data.signedUrl;
}
