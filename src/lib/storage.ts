import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Pick ONE bucket name and stick to it. You're currently using "event-images".
const BUCKET = process.env.SB_BUCKET_NAME || "event-images";

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
}: { 
  projectId: string; 
  roomId: string; 
  buffer: Buffer; 
  mime: string; 
}) {
  const { ulid } = await import("ulid");
  const id = ulid();
  const ext = mime === "image/png" ? "png" : "jpg";

  // Keep the prefix out of the path if the bucket already implies purpose
  const path = `${projectId}/${roomId}/generated/${id}.${ext}`;

  // Try with anon client first (faster if RLS allows it)
  let up = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  // If anon client fails, try with admin client (bypasses RLS)
  if (up.error) {
    console.log(`[saveBufferToProjectStorage] Anon client upload failed, trying admin client: ${up.error.message}`);
    const { supabaseAdmin } = await import('./supabaseAdmin');
    const adminUp = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (adminUp.error) {
      console.error(`[saveBufferToProjectStorage] Admin client upload also failed:`, adminUp.error);
      throw adminUp.error;
    }
    // Use admin client for public URL too
    const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return { bucket: BUCKET, path, publicUrl: pub.publicUrl };
  }

  // OPTION A: public bucket (simple)
  const pub = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub.data.publicUrl;

  // OPTION B (if bucket is private): signed URL for 7 days
  // const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  // const publicUrl = signed.data.signedUrl;

  return { bucket: BUCKET, path, publicUrl };
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

  const { supabaseAdmin } = await import('./supabaseAdmin');
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
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
 * Upload a generated 3D mesh file to storage
 */
export async function uploadGeneratedMesh({
  projectId,
  productId,
  buffer,
  mime = 'model/gltf-binary',
}: {
  projectId: string;
  productId: string;
  buffer: Buffer;
  mime?: string;
}): Promise<StorageResult> {
  const { ulid } = await import("ulid");
  const id = ulid();
  const ext = mime.includes('gltf') ? 'glb' : 'obj';
  const path = `${projectId}/meshes/${productId}/${id}.${ext}`;

  const { supabaseAdmin } = await import('./supabaseAdmin');
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    console.error('[uploadGeneratedMesh] Upload failed:', error);
    throw error;
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { bucket: BUCKET, path, publicUrl: pub.publicUrl };
}
