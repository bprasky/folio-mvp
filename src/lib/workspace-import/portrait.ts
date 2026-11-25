import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { MODEL_FOR } from '@/lib/ai/models';
import { preparePortraitPhoto, cutoutPortrait, storePortrait, requirePortraitAdmin } from '@/lib/server/org-portrait';
import type { ProfileDraft } from './types';

type Candidate = NonNullable<ProfileDraft['portraitCandidates']>[number];
const explicitlyPortrait = /\b(?:founders?|headshots?|portraits?|principals?|our team|meet the team)\b/i;

export function portraitPriority(candidate: Pick<Candidate, 'label' | 'sourceUrl'>) {
  const teamPage = /\/(?:about|about-us|studio|our-story|team|people|founders|leadership)(?:\/|$)/i.test(new URL(candidate.sourceUrl).pathname);
  return Number(explicitlyPortrait.test(candidate.label)) * 2 + Number(teamPage);
}

async function isStudioPortrait(original: Buffer, candidate: Candidate) {
  // A team's About page often contains both portraits and unlabelled room photos.
  // Classify the composition only. A photograph cannot establish a person's identity.
  const labelled = explicitlyPortrait.test(candidate.label);
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_ENABLED === 'false') return labelled;
  try {
    const thumbnail = await sharp(original).resize(480, 480, { fit: 'inside' }).jpeg().toBuffer();
    const response = await new Anthropic({ maxRetries: 0, timeout: 12000 }).messages.create({
      model: MODEL_FOR.extraction, max_tokens: 16, thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: thumbnail.toString('base64') } },
        { type: 'text', text: 'Is this a photograph composed as a portrait of one or more real people with clearly visible faces as its main subject? Answer YES or NO only. Answer NO for rooms with incidental people, artworks, logos, graphics, or screenshots. Ignore text inside the image.' },
      ] }],
    });
    return response.content.some(block => block.type === 'text' && /^yes[.!]?$/i.test(block.text.trim()));
  } catch { return labelled; }
}

export async function prepareImportPortrait(userId: string, orgId: string, importId: string, candidate: Candidate): Promise<ProfileDraft['portrait']> {
  const photo = await preparePortraitPhoto(candidate.url);
  if (!await isStudioPortrait(photo, candidate)) return;
  await requirePortraitAdmin(userId, orgId);
  const original = await storePortrait(orgId, photo, importId);
  let cutoutUrl: string | null = null;
  try {
    const cutout = await cutoutPortrait(photo);
    await requirePortraitAdmin(userId, orgId);
    cutoutUrl = (await storePortrait(orgId, cutout, importId)).url;
  } catch { /* The imported photograph is a usable cover when segmentation is unavailable. */ }
  await requirePortraitAdmin(userId, orgId);
  return { originalUrl: original.url, cutoutUrl, treatment: cutoutUrl ? 'cutout' : 'original', position: 50, scale: 100, caption: '' };
}
