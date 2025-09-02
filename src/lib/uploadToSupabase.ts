import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';

const PREFERRED = process.env.FOLIO_STORAGE_BUCKET;
const FALLBACKS = ['event-images', 'events', 'images', 'public'];

// Make a tidy folder name from any label; return null if empty
function safeLabel(label?: string | null) {
  const s = (label ?? '').toString().trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s.length ? s : null;
}

export function buildObjectPath(kind: 'festivals'|'events', labelOrNull: string | null, ext: string) {
  const base = safeLabel(labelOrNull);
  const file = `${randomUUID()}.${ext}`;
  return base ? `${kind}/${base}/${file}` : `${kind}/${file}`;
}

async function tryUpload(bucket: string, path: string, buffer: Buffer, mime: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`upload@${bucket}: ${error.message}`);
  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[upload ok]', { bucket, path, bytes: buffer.length });
  }
  return { publicUrl: pub.publicUrl, bucket, path };
}

export async function uploadDataUrlToSupabase(dataUrl: string, path?: string) {
  if (!dataUrl?.startsWith('data:') || !dataUrl.includes(';base64,')) {
    throw new Error('Invalid data URL format');
  }
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/^data:(.*?);base64$/)?.[1] ?? 'image/jpeg';
  const ext = mime.split('/')[1] ?? 'jpg';
  const uploadPath = path || `events/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(b64, 'base64');

  const candidates = Array.from(new Set([PREFERRED, ...FALLBACKS])).filter(Boolean) as string[];
  const errors: string[] = [];

  for (const bucket of candidates) {
    try {
      const res = await tryUpload(bucket, uploadPath, buffer, mime);
      const usedFallback = !PREFERRED || bucket !== PREFERRED;
      if (usedFallback && process.env.NODE_ENV === 'production') {
        console.warn('[upload warning] using fallback bucket:', bucket);
      }
      return res.publicUrl; // keep return shape same for callers
    } catch (e: any) {
      errors.push(`{ bucket: ${bucket}, message: ${e.message} }`);
    }
  }
  throw new Error(`Image upload failed: ${errors.join(' | ')}`);
}
