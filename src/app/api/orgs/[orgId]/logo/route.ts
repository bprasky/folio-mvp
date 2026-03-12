export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserOrgMemberships, isOrgAdmin } from '@/lib/permissions';
import { randomUUID } from 'crypto';

const BUCKET = 'user-avatars';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = params;

    // Check admin permission
    const memberships = await getUserOrgMemberships(session.user.id);
    if (!isOrgAdmin(memberships, orgId)) {
      return NextResponse.json(
        { error: 'Only organization admins can update the logo' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `org-logos/${orgId}/${randomUUID()}.${ext}`;

    // Delete old logo if stored in the same bucket
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { logo: true },
    });

    if (org?.logo && org.logo.includes(BUCKET)) {
      try {
        const url = new URL(org.logo);
        const match = url.pathname.match(/\/object\/public\/user-avatars\/(.+)/);
        if (match) {
          await supabaseAdmin.storage.from(BUCKET).remove([match[1]]);
        }
      } catch {
        // Ignore errors deleting old logo
      }
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[POST /api/orgs/[orgId]/logo] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path);

    const logo = urlData.publicUrl;

    await prisma.organization.update({
      where: { id: orgId },
      data: { logo },
    });

    return NextResponse.json({ logo });
  } catch (error) {
    console.error('[POST /api/orgs/[orgId]/logo] Error:', error);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}
