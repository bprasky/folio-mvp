import 'server-only';
import { createHash, randomUUID } from 'crypto';
import { requestIdentity } from '@/lib/persistence/requestIdentity';
import sharp from 'sharp';
import { createFalClient } from '@fal-ai/client';
import { prisma } from '@/lib/prisma';
import { can, isOrgRole } from '@/lib/orgPermissions';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isWorkspaceImport, WORKSPACE_IMPORT_KIND } from '@/lib/workspace-import/types';
import { fetchProjectImage } from './project-image-input';

export class PortraitError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export async function requirePortraitAdmin(userId: string, orgId: string) {
  const member = await prisma.organizationUser.findFirst({ where: { userId, organizationId: orgId, isActive: true }, select: { role: true } });
  if (!member || !isOrgRole(member.role) || !can(member.role, 'edit_org_profile'))
    throw new PortraitError('Only studio owners and admins can edit the cover.', 403);
}

export function ownedProfileImage(url: string, orgId: string) {
  try {
    const parsed = new URL(url);
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prefix = `/storage/v1/object/public/user-avatars/org-profile/${encodeURIComponent(orgId)}/`;
    return !!origin && parsed.origin === new URL(origin).origin && !parsed.search && !parsed.hash &&
      parsed.pathname.startsWith(prefix) && /^[a-f0-9]{8}-[a-f0-9]{4}-[45][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(parsed.pathname.slice(prefix.length));
  } catch { return false; }
}

export async function portraitCandidates(orgId: string, importId?: string) {
  const rows = await prisma.importSession.findMany({ where: {
    ...(importId ? { id: importId } : {}),
    AND: [{ processingMeta: { path: ['kind'], equals: WORKSPACE_IMPORT_KIND } }, { processingMeta: { path: ['orgId'], equals: orgId } }],
  }, orderBy: { createdAt: 'desc' }, take: importId ? 1 : 3, select: { id: true, processingMeta: true } });
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const run = row.processingMeta;
    if (!isWorkspaceImport(run) || run.orgId !== orgId) return [];
    return (run.profile.portraitCandidates || []).flatMap(candidate => {
      if (seen.has(candidate.url)) return [];
      seen.add(candidate.url);
      return [{ ...candidate, importId: row.id }];
    });
  }).slice(0, 12);
}

export async function preparePortraitPhoto(url: string) {
  const source = await fetchProjectImage(url);
  return sharp(source.buffer, { limitInputPixels: 40_000_000, animated: false })
    .rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}

/** Segmentation supplies alpha only; every visible RGB pixel comes from the original photograph. */
export async function cutoutPortrait(original: Buffer) {
  if (!process.env.FAL_KEY) throw new PortraitError('Cutout is unavailable. You can keep the original photograph.', 503);
  const fal = createFalClient({ credentials: process.env.FAL_KEY });
  const result = await fal.run('fal-ai/birefnet', {
    input: { image_url: `data:image/png;base64,${original.toString('base64')}`, model: 'Portrait',
      output_mask: true, refine_foreground: false, output_format: 'png', sync_mode: true },
    abortSignal: AbortSignal.timeout(55_000),
  });
  const url: unknown = result.data?.mask_image?.url;
  if (typeof url !== 'string') throw new PortraitError('The cutout could not be prepared. Keep the original or try again.', 502);
  let mask: Buffer;
  if (url.startsWith('data:image/png;base64,') && url.length < 12_000_000) mask = Buffer.from(url.slice(22), 'base64');
  else if (url.startsWith('https:')) mask = (await fetchProjectImage(url)).buffer;
  else throw new PortraitError('The cutout could not be read. Please try again.', 502);
  const { width, height } = await sharp(original).metadata();
  const alpha = await sharp(mask, { limitInputPixels: 40_000_000 }).resize(width, height, { fit: 'fill' }).removeAlpha().greyscale().raw().toBuffer();
  const foreground = alpha.reduce((total, value) => total + value, 0) / (alpha.length * 255);
  if (foreground < .01 || foreground > .98) throw new PortraitError('We could not separate the portrait cleanly. Use the original photograph.', 422);
  // Sharp removes alpha after channel joins in a single pipeline; materialize RGB first.
  const rgb = await sharp(original).removeAlpha().toColourspace('srgb').raw().toBuffer();
  return sharp(rgb, { raw: { width: width!, height: height!, channels: 3 } })
    .joinChannel(alpha, { raw: { width: width!, height: height!, channels: 1 } }).png().toBuffer();
}

export async function storePortrait(orgId: string, buffer: Buffer, importId?: string) {
  if (buffer.length > 8 * 1024 * 1024) throw new PortraitError('Choose a smaller portrait.', 413);
  // A worker can be interrupted after storage accepts the bytes but before its checkpoint.
  const id = importId ? requestIdentity('import-portrait', [orgId, importId, createHash('sha256').update(buffer).digest('hex')]) : randomUUID();
  const path = `org-profile/${encodeURIComponent(orgId)}/${id}.png`;
  const { error } = await supabaseAdmin.storage.from('user-avatars').upload(path, buffer, { contentType: 'image/png', upsert: !!importId });
  if (error) throw new PortraitError('Could not save the portrait image. Please retry.', 500);
  return { path, url: supabaseAdmin.storage.from('user-avatars').getPublicUrl(path).data.publicUrl };
}

export async function removePreparedPortraits(paths: string[]) {
  if (paths.length) await supabaseAdmin.storage.from('user-avatars').remove(paths);
}
