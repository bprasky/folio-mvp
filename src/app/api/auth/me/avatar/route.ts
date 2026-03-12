export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { randomUUID } from 'crypto';

const BUCKET = 'user-avatars';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function getUserId(req: Request) {
  const s = await getServerSession();
  if (s?.user?.id) return s.user.id;
  const t = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET }).catch(() => null);
  return (t?.sub as string) ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Read file into buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Determine extension
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `avatars/${userId}/${randomUUID()}.${ext}`;

    // Delete old avatar if it's in the same bucket
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profileImage: true },
    });

    if (user?.profileImage && user.profileImage.includes(BUCKET)) {
      try {
        const url = new URL(user.profileImage);
        // Extract the path after /object/public/user-avatars/
        const match = url.pathname.match(/\/object\/public\/user-avatars\/(.+)/);
        if (match) {
          await supabaseAdmin.storage.from(BUCKET).remove([match[1]]);
        }
      } catch {
        // Ignore errors deleting old avatar
      }
    }

    // Upload new avatar
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[POST /api/auth/me/avatar] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    const profileImage = urlData.publicUrl;

    // Update user record
    await prisma.user.update({
      where: { id: userId },
      data: { profileImage },
    });

    return NextResponse.json({ profileImage });
  } catch (error) {
    console.error('[POST /api/auth/me/avatar] Error:', error);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
