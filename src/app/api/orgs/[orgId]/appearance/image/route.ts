import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';
import { stripExifMetadata } from '@/lib/storage';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const BUCKET = 'user-avatars';
const MAX_BYTES = 5 * 1024 * 1024;
const headers = { 'Cache-Control': 'private, no-store' };
type Context = { params: { orgId: string } | Promise<{ orgId: string }> };

class UploadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function requireAdmin(userId: string, orgId: string) {
  const member = await prisma.organizationUser.findFirst({
    where: { userId, organizationId: orgId, isActive: true }, select: { role: true },
  });
  if (!member || !isOrgRole(member.role) || !can(member.role, 'edit_org_profile')) {
    throw new UploadError('Only organization owners and admins can upload page images.', 403);
  }
}

async function readUpload(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new UploadError('Choose an image file.', 400);
  const reader = request.body?.getReader();
  if (!reader) throw new UploadError('Choose an image file.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 15000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES + 65536) { await reader.cancel(); throw new UploadError('Choose an image smaller than 5 MB.', 413); }
      chunks.push(value);
    }
    if (timedOut) throw new UploadError('Image upload timed out. Please retry.', 408);
    const body = new Request(request.url, { method: 'POST', headers: request.headers, body: Buffer.concat(chunks) });
    try { return await body.formData(); }
    catch { throw new UploadError('The image upload could not be read. Please retry.', 400); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export async function POST(request: NextRequest, { params }: Context) {
  let uploadedPath: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to manage this page.' }, { status: 401, headers });
    const { orgId } = await params;
    await requireAdmin(session.user.id, orgId);
    const form = await readUpload(request);
    const file = form.get('file');
    if (!file || typeof file === 'string' || form.getAll('file').length !== 1) throw new UploadError('Choose one image file.', 400);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new UploadError('Choose a JPEG, PNG or WebP image.', 400);
    if (!file.size || file.size > MAX_BYTES) throw new UploadError('Choose an image smaller than 5 MB.', 413);
    const input = Buffer.from(await file.arrayBuffer());
    let prepared: Buffer;
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    try {
      const metadata = await sharp(input, { limitInputPixels: 40_000_000, animated: false }).metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Invalid format');
      prepared = await stripExifMetadata(input, mime);
    } catch { throw new UploadError('This image could not be read. Choose a valid JPEG, PNG or WebP.', 400); }
    if (prepared.length > MAX_BYTES) throw new UploadError('This image is too large after processing. Choose a smaller image.', 413);
    const path = `org-profile/${encodeURIComponent(orgId)}/${randomUUID()}.${mime === 'image/png' ? 'png' : 'jpg'}`;
    // Public profile assets are deliberate admin uploads. The service client is
    // scoped to this authorized org; project photos keep their protected URLs.
    const upload = await supabaseAdmin.storage.from(BUCKET).upload(path, prepared, { contentType: mime, upsert: false });
    if (upload.error) throw new UploadError('Could not upload this image. Please retry.', 500);
    uploadedPath = path;
    await requireAdmin(session.user.id, orgId);
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    // Uploading only prepares the asset. The appearance PATCH makes it visible
    // on the page; existing images remain safe if the edit is cancelled.
    return NextResponse.json({ url: data.publicUrl }, { headers });
  } catch (error) {
    if (uploadedPath) {
      try { await supabaseAdmin.storage.from(BUCKET).remove([uploadedPath]); }
      catch { console.error('[Organization appearance] Could not clean up unsuccessful upload'); }
    }
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error('[Organization appearance] Image upload failed');
    return NextResponse.json({ error: 'Could not upload this image. Please retry.' }, { status: 500, headers });
  }
}
