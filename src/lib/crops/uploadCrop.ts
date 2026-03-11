import { prisma } from "@/lib/prisma";

const BUCKET = process.env.SB_BUCKET_NAME || "event-images";

export interface UploadCropResult {
  bucket: string;
  path: string;
  publicUrl: string;
}

export async function uploadCrop({
  buffer,
  tagId,
  projectId,
}: {
  buffer: Buffer;
  tagId: string;
  projectId: string;
}): Promise<UploadCropResult> {
  const path = `crops/${projectId}/${tagId}.webp`;

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");

  // Upsert: overwrite if a crop already exists for this tag
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: "image/webp",
    upsert: true,
  });

  if (error) {
    console.error("[uploadCrop] Upload failed:", error);
    throw error;
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  // Update the ProductTag record with the crop URL
  await prisma.productTag.update({
    where: { id: tagId },
    data: { cropUrl: publicUrl },
  });

  return { bucket: BUCKET, path, publicUrl };
}
