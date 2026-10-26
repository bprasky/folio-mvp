import { protectedPhotoUrl } from '@/lib/files/projectPhotoUrl';
import { PRIVATE_PHOTO_BUCKET } from '@/lib/server/protected-project-photo';
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Lazy initialization to avoid build-time errors when env vars aren't available
let _supabase: SupabaseClient | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

// Pick ONE bucket name and stick to it. You're currently using "event-images".
const BUCKET = process.env.SB_BUCKET_NAME || "event-images";

// Separate bucket for 3D meshes and masks — keeps binary assets out of the image bucket
const MESH_BUCKET = 'product-meshes';

/**
 * Strip EXIF metadata from image buffer for privacy and security
 * Removes GPS coordinates, timestamps, camera info, etc.
 * @param buffer - Original image buffer
 * @param mime - MIME type of the image
 * @returns Buffer with EXIF data removed
 */
export async function stripExifMetadata(buffer: Buffer, mime: string): Promise<Buffer> {
  // Sharp strips metadata by default. Never return original bytes on decode failure.
  const processor = sharp(buffer, { limitInputPixels: 40_000_000, animated: false }).rotate();
  return mime === 'image/png' ? processor.png().toBuffer() : processor.jpeg({ quality: 90 }).toBuffer();
}

export interface StorageResult {
  bucket: string;
  path: string;
  publicUrl: string;
}

export async function saveBufferToProjectStorage({
  projectId,
  roomId,
  buffer,
  mime,
  storageId,
}: {
  projectId: string;
  roomId: string;
  buffer: Buffer;
  mime: string;
  storageId?: string;
}) {
  const { ulid } = await import("ulid");
  if (storageId && !/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(storageId)) throw new Error('Invalid upload identity');
  const id = storageId || ulid();
  const ext = mime === "image/png" ? "png" : "jpg";

  // Strip EXIF metadata for privacy (removes GPS, timestamps, camera info)
  const sanitizedBuffer = await stripExifMetadata(buffer, mime);
  if (sanitizedBuffer.length > 20 * 1024 * 1024) throw new Error('Prepared project photo exceeds the storage limit.');

  // Keep the prefix out of the path if the bucket already implies purpose
  const path = `${projectId}/${roomId}/generated/${id}.${ext}`;

  const { supabaseAdmin } = await import('./supabaseAdmin');
  // Provision a separate private bucket before rollout; never change legacy visibility.
  const bucket = await supabaseAdmin.storage.getBucket(PRIVATE_PHOTO_BUCKET);
  if (bucket.error || !bucket.data || bucket.data.public !== false) throw new Error('Private project photo storage is not configured.');
  const upload = await supabaseAdmin.storage.from(PRIVATE_PHOTO_BUCKET).upload(path, sanitizedBuffer, {
    contentType: mime === 'image/png' ? 'image/png' : 'image/jpeg', upsert: false, cacheControl: '0',
  });
  // Identical deterministic uploads are immutable. A losing request uses the same
  // object and must never delete it during cleanup (the caller tracks this).
  if (upload.error && !(storageId && String((upload.error as any).statusCode) === '409')) throw upload.error;
  return { bucket: PRIVATE_PHOTO_BUCKET, path, publicUrl: protectedPhotoUrl(path) };

}

export async function deleteProjectImage(path: string): Promise<void> {
  try {
    // Extract bucket and path from the full path
    // Assuming path format: bucket/subfolder/... or just subfolder/...
    const pathParts = path.split('/');
    if (pathParts.length < 2) {
      throw new Error('Invalid storage path format');
    }

    // For now, we'll assume the bucket is the first part or use a default
    // In a more robust implementation, you'd parse the full URL
    const bucket = pathParts[0] || 'project-assets';
    const objectPath = pathParts.slice(1).join('/');

    // Import Supabase admin client
    const { supabaseAdmin } = await import('./supabaseAdmin');

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([objectPath]);

    if (error) {
      console.error('Storage deletion failed:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  } catch (error) {
    console.error('Storage deletion error:', error);
    throw new Error(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a generated 2D cutout image to storage
 */
export async function uploadGeneratedCutout({
  projectId,
  productId,
  buffer,
  mime = 'image/png',
}: {
  projectId: string;
  productId: string;
  buffer: Buffer;
  mime?: string;
}): Promise<StorageResult> {
  const { ulid } = await import("ulid");
  const id = ulid();
  const ext = mime === "image/png" ? "png" : "jpg";
  const path = `${projectId}/cutouts/${productId}/${id}.${ext}`;

  // Strip EXIF metadata for privacy
  const sanitizedBuffer = await stripExifMetadata(buffer, mime);

  const { supabaseAdmin } = await import('./supabaseAdmin');
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, sanitizedBuffer, {
    contentType: mime === 'image/png' ? 'image/png' : 'image/jpeg',
    upsert: false,
  });

  if (error) {
    console.error('[uploadGeneratedCutout] Upload failed:', error);
    throw error;
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { bucket: BUCKET, path, publicUrl: pub.publicUrl };
}

/**
 * Upload a generated product mask PNG (from SAM segmentation) to storage
 */
export async function uploadGeneratedMask({
  projectId,
  tagId,
  buffer,
  mime = 'image/png',
}: {
  projectId: string;
  tagId: string;
  buffer: Buffer;
  mime?: string;
}): Promise<StorageResult> {
  const { ulid } = await import("ulid");
  const id = ulid();
  const ext = mime === "image/png" ? "png" : "jpg";
  const path = `${projectId}/masks/${tagId}/${id}.${ext}`;

  const sanitizedBuffer = await stripExifMetadata(buffer, mime);

  const { supabaseAdmin } = await import('./supabaseAdmin');
  const { error } = await supabaseAdmin.storage.from(MESH_BUCKET).upload(path, sanitizedBuffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    console.error('[uploadGeneratedMask] Upload failed:', error);
    throw error;
  }

  const { data: pub } = supabaseAdmin.storage.from(MESH_BUCKET).getPublicUrl(path);
  return { bucket: MESH_BUCKET, path, publicUrl: pub.publicUrl };
}

/**
 * Upload a generated 3D mesh file to storage
 */
export async function uploadGeneratedMesh({
  projectId,
  productId,
  buffer,
  mime = 'application/octet-stream',
}: {
  projectId: string;
  productId: string;
  buffer: Buffer;
  mime?: string;
}): Promise<StorageResult> {
  const { ulid } = await import("ulid");
  const id = ulid();
  const ext = (mime.includes('gltf') || mime === 'application/octet-stream') ? 'glb' : 'obj';
  const path = `${projectId}/meshes/${productId}/${id}.${ext}`;

  const { supabaseAdmin } = await import('./supabaseAdmin');
  const { error } = await supabaseAdmin.storage.from(MESH_BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    console.error('[uploadGeneratedMesh] Upload failed:', error);
    throw error;
  }

  const { data: pub } = supabaseAdmin.storage.from(MESH_BUCKET).getPublicUrl(path);
  return { bucket: MESH_BUCKET, path, publicUrl: pub.publicUrl };
}
