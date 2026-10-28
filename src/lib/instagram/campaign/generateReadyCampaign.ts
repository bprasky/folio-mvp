import 'server-only';
import JSZip from 'jszip';
import { prisma } from '@/lib/prisma';
import type { RoomSpotlightFormat } from './generateRoomSpotlight';
import { renderApprovedImage } from '@/lib/publishing-studio/readiness/render-image';
import { generateCaptionsFile } from './generateCaptions';
import { getApprovedCampaignCandidates, recordCampaignCandidateEvent } from '@/lib/publishing-studio/readiness/service';
import { approvedPhotoPresentations, approvedHeadlinePhoto } from '@/lib/instagram-export/approved-photo-presentations';

/** The readiness path exports only the current approved source snapshots. */
export async function generateReadyCampaign(userId: string, projectId: string, formats: RoomSpotlightFormat[]) {
  const candidates = await getApprovedCampaignCandidates(userId, projectId);
  if (!candidates.length) throw new Error('CAMPAIGN_INELIGIBLE: No ready stories are available for this project.');
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: {
    title: true, isPublic: true, post: { select: { status: true, slug: true } },
    designer: { select: { name: true, studio: true } },
  } });
  if (!project?.isPublic || project.post?.status !== 'PUBLISHED') {
    throw new Error('CAMPAIGN_INELIGIBLE: Publish this project before building a campaign.');
  }
  const zip = new JSZip();
  const presentations = await approvedPhotoPresentations([projectId]);
  const captions = [];
  for (const [index, candidate] of Array.from(candidates.entries())) {
    const folder = zip.folder(`${String(index + 1).padStart(2, '0')}-story`)!;
    for (const format of formats) {
      const height = format === 'square' ? 1080 : format === 'portrait' ? 1350 : 1920;
      if (!candidate.imageUrls.length) throw new Error('Campaign story has no approved images');
      for (const [slideIndex, url] of Array.from(candidate.imageUrls.entries())) {
        const photo = approvedHeadlinePhoto(presentations[projectId]?.[url], candidate.title, candidate.designerName);
        const image = await renderApprovedImage(url, 1080, height, projectId, photo);
        folder.file(`slide-${slideIndex + 1}-${format}.jpg`, image);
      }
    }
    captions.push({ postNumber: index + 1, postType: 'editorial_story', caption: candidate.caption, hashtags: [] });
  }
  // Rendering can take time. Fail closed if any approved source changed meanwhile.
  const current = await getApprovedCampaignCandidates(userId, projectId);
  if (candidates.some(candidate => !current.some(item => item.id === candidate.id && item.version === candidate.version && item.sourceVersion === candidate.sourceVersion))) {
    throw new Error('CAMPAIGN_INELIGIBLE: A story changed during generation. Review the current stories and try again.');
  }
  zip.file('captions.txt', generateCaptionsFile(captions));
  zip.file('README.txt', `Instagram Campaign for ${project.title}\nTotal Posts: ${candidates.length}\nEach numbered folder is one approved story.\n`);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const campaign = await prisma.instagramCampaign.create({ data: {
    projectId, preset: 'custom', totalPosts: candidates.length, formats,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    includeRooms: false, includeProducts: false, includeQuotes: false, includeDetails: false,
    posts: { create: candidates.map((candidate, index) => ({ postType: 'editorial_story', sequenceNum: index + 1,
      title: candidate.title, caption: candidate.caption, hashtags: [], format: formats,
      imageIds: candidate.imageIds, productIds: [], roomName: null })) },
  } });
  try {
    for (const candidate of candidates) {
      await recordCampaignCandidateEvent(userId, candidate.id, candidate.version, candidate.sourceVersion, campaign.id, 'exported');
    }
  } catch {
    // The durable campaign already exists. Do not imply nothing was saved or
    // encourage a blind retry that would create another campaign record.
    throw new Error(`Campaign ${campaign.id} was saved, but its export history could not be completed. The download was not delivered. Check your saved campaigns before trying again.`);
  }
  return { campaignId: campaign.id, title: project.title, base64Zip: buffer.toString('base64') };
}
