import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';
import { orgProfileAppearanceSchema } from '@/lib/org-profile-appearance';
import { getOrgProfileAppearanceData } from '@/lib/server/org-profile-appearance';

export const dynamic = 'force-dynamic';
type Context = { params: { orgId: string } | Promise<{ orgId: string }> };
const privateHeaders = { 'Cache-Control': 'private, no-store' };

class AppearanceError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function requireAdmin(userId: string, orgId: string) {
  const member = await prisma.organizationUser.findFirst({
    where: { userId, organizationId: orgId, isActive: true }, select: { role: true },
  });
  if (!member || !isOrgRole(member.role) || !can(member.role, 'edit_org_profile')) {
    throw new AppearanceError('Only organization owners and admins can change page appearance.', 403);
  }
}

function ownedUpload(url: string, orgId: string): boolean {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!origin) return false;
  try {
    const parsed = new URL(url);
    const prefix = `/storage/v1/object/public/user-avatars/org-profile/${encodeURIComponent(orgId)}/`;
    return parsed.origin === new URL(origin).origin && !parsed.search && !parsed.hash &&
      parsed.pathname.startsWith(prefix) &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(parsed.pathname.slice(prefix.length));
  } catch { return false; }
}

async function readAppearance(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppearanceError('Page appearance is required.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 15000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new AppearanceError('Page appearance is too large.', 413); }
      chunks.push(value);
    }
    if (timedOut) throw new AppearanceError('The save timed out. Please retry.', 408);
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new AppearanceError('Page appearance must be valid JSON.', 400); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

function failure(error: unknown) {
  if (error instanceof AppearanceError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders });
  console.error('[Organization appearance] Request failed');
  return NextResponse.json({ error: 'Could not save or load page appearance. Please retry.' }, { status: 500, headers: privateHeaders });
}

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to manage this page.' }, { status: 401, headers: privateHeaders });
    const { orgId } = await params;
    await requireAdmin(session.user.id, orgId);
    const data = await getOrgProfileAppearanceData(orgId);
    if (!data) return NextResponse.json({ error: 'Organization not found.' }, { status: 404, headers: privateHeaders });
    return NextResponse.json(data, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Sign in to manage this page.' }, { status: 401, headers: privateHeaders });
    const { orgId } = await params;
    await requireAdmin(session.user.id, orgId);
    const parsed = orgProfileAppearanceSchema.safeParse(await readAppearance(request));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the page appearance fields.' }, { status: 400, headers: privateHeaders });
    const appearance = parsed.data;
    if ((appearance.cover.kind === 'upload' && !ownedUpload(appearance.cover.url, orgId)) ||
        (appearance.identity.url !== null && !ownedUpload(appearance.identity.url, orgId))) {
      throw new AppearanceError('Upload this image for this organization before saving it.', 400);
    }
    await prisma.$transaction(async tx => {
      const member = await tx.organizationUser.findFirst({
        where: { userId: session.user.id, organizationId: orgId, isActive: true }, select: { role: true },
      });
      if (!member || !isOrgRole(member.role) || !can(member.role, 'edit_org_profile')) {
        throw new AppearanceError('You no longer have permission to change this page.', 403);
      }
      if (appearance.cover.kind === 'project') {
        const image = await tx.projectImage.findFirst({
          where: { id: appearance.cover.imageId, inclusion: 'INCLUDED', project: { designerOrgId: orgId, isPublic: true } },
          select: { id: true },
        });
        if (!image) throw new AppearanceError('Choose a visible photograph from one of this organization’s public projects.', 400);
      }
      await tx.organization.update({ where: { id: orgId }, data: { profileAppearance: appearance }, select: { id: true } });
    });
    revalidatePath(`/org/${orgId}`);
    revalidatePath(`/org/${orgId}/settings`);
    return NextResponse.json({ appearance }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
