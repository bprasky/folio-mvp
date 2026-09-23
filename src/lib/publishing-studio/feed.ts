import { createHash } from 'crypto';
import type { StudioFeedCard, StudioData } from './types';
import { feedOpportunity } from './opportunities';

type Project = {
  id: string; title: string; ownerId: string; designerId: string | null; isPublic: boolean;
  images: { id: string; url: string; room: string | null; roomId: string | null; inclusion: string }[];
  rooms: { id: string; name: string }[];
  designer: { name: string | null } | null;
  post: { status: string; updatedAt: Date; excerpt: string | null; heroAssetId: string | null; expandedBlocks: unknown } | null;
};
type Saved = { id: string; projectId: string; headline: string | null; caption: string | null; status: string; updatedAt: Date; config: unknown };
type Campaign = { id: string; projectId: string; createdAt: Date; posts: { title: string | null; caption: string; imageIds: string[] }[] };
export function configObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const defaultPreview: NonNullable<StudioFeedCard['preview']> = { aspectRatio: '4:5', headlinePosition: 'bottom_left', watermarkStyle: 'minimal' };
const MAX_PROPOSAL_OPTION_LENGTH = 5000;

/** One asset/layout resolver for saved cards, release plans and editor entry. */
export function savedPublicationPreview(config: Record<string, unknown>, sourceImages: {url:string}[], fallbackName: string) {
  const allowed = new Set(sourceImages.map(image => image.url));
  const requested = Array.isArray(config.selectedImageUrls) ? config.selectedImageUrls : [];
  const images = requested.filter((url): url is string => typeof url === 'string' && allowed.has(url));
  // Do not substitute a project hero for a missing saved first image.
  const first = typeof requested[0] === 'string' && allowed.has(requested[0]) ? requested[0] : null;
  const preview = { ...defaultPreview, watermarkStyle: 'folio_x' as const } as NonNullable<StudioFeedCard['preview']>;
  if (['1:1', '4:5', '9:16'].includes(String(config.aspectRatio))) preview.aspectRatio = config.aspectRatio as typeof preview.aspectRatio;
  if (['bottom_left', 'bottom_center', 'top_left'].includes(String(config.headlinePosition))) preview.headlinePosition = config.headlinePosition as typeof preview.headlinePosition;
  if (['folio_x', 'folio_presents', 'minimal'].includes(String(config.watermarkStyle))) preview.watermarkStyle = config.watermarkStyle as typeof preview.watermarkStyle;
  const designerName = typeof config.designerName === 'string' ? config.designerName : fallbackName;
  preview.watermarkText = preview.watermarkStyle === 'minimal' ? 'folio'
    : preview.watermarkStyle === 'folio_presents' ? `folio presents ${designerName}` : `folio × ${designerName}`;
  return { imageUrl: first, imageUrls: images, preview };
}

// Keep whole source passages rather than truncating a quote or changing its meaning.
function proposalOptions(options: string[]): string[] {
  return options.filter(option => option.length <= MAX_PROPOSAL_OPTION_LENGTH).slice(0, 10);
}

// Conservative editorial triage, not a claim of AI generation. Only reuse published
// prose; a room label, materials list, or attractive photograph is not a story angle.
export function publishedStoryProposal(body: unknown) {
  const paragraphs = Array.isArray(body) ? body.filter((v): v is string => typeof v === 'string' && Boolean(v.trim())).map(v => v.trim()) : [];
  const sentences = paragraphs.flatMap(p => p.match(/[^.!?]+[.!?]+["”’']?|[^.!?]+$/g) || []).map(s => s.trim()).filter(Boolean);
  const change = /\b(iterations?|mock-?ups?|prototypes?|replaced?|rejected?|abandoned|cracked|original plan|wasn't (?:the|part of the) plan)\b/i;
  const constraint = /\b(too (?:flat|large|small|dark|heavy)|didn't (?:fit|work)|wouldn't|couldn't|constraint|challenge|risk|nervous|blocking|needed|had to|without)\b/i;
  const resolution = /\b(finally|ended up|until|so that|because|replaced|paid off|made (?:it|the room)|while|rather than)\b/i;
  const ranked = sentences.map((text, index) => ({ text, index,
    score: (change.test(text) ? 4 : 0) + (constraint.test(text) ? 1 : 0) + (resolution.test(text) ? 1 : 0) }));
  // Require a specific change or tested alternative plus enough context to explain it.
  // General adjectives and routine material benefits deliberately do not qualify.
  const best = [...ranked].sort((a, b) => b.score - a.score || a.index - b.index)[0];
  if (!best || best.score < 4 || best.text.length > MAX_PROPOSAL_OPTION_LENGTH || paragraphs.join(' ').split(/\s+/).length < 35 || sentences.length < 2) return null;
  const beats = proposalOptions(ranked.filter(s => s.score > 0 || Math.abs(s.index - best.index) <= 1).slice(0, 4).map(s => s.text));
  const full = paragraphs.join('\n\n');
  const focused = paragraphs.find(p => p.includes(best.text)) || full;
  return { pitch: best.text, rationale: 'A published design decision with a change or alternative worth explaining.',
    beats, caption: full, captionOptions: proposalOptions(Array.from(new Set([full, focused]))),
    score: ranked.reduce((sum, s) => sum + s.score, 0) };
}

/** Pure source assembly: no generation, writes, unpublished interviews, or invented quotations. */
export function buildStudioFeed(projects: Project[], saved: Saved[], campaigns: Campaign[], ideas: StudioData['ideas'], userId: string, orgWrite: boolean): StudioFeedCard[] {
  const feed: StudioFeedCard[] = [];
  const sourceProposals = new Map<string, StudioFeedCard>();
  const byId = new Map(projects.map(p => [p.id, p]));
  const canWrite = (p: Project) => p.post?.status === 'PUBLISHED' && (orgWrite || p.ownerId === userId || p.designerId === userId);
  const sourceKeys = new Set(saved.map(s => configObject(s.config).studioCardId).filter((v): v is string => typeof v === 'string'));
  for (const p of projects) {
    if (!p.isPublic || p.post?.status !== 'PUBLISHED') continue;
    const photos = p.images.filter(image => image.inclusion === 'INCLUDED');
    const hero = photos.find(image => image.id === p.post?.heroAssetId) || photos[0];
    if (!hero) continue;
    const images = [hero, ...photos.filter(image => image.id !== hero.id)].slice(0, 4).map(image => image.url);
    const title = p.title || 'Project story';
    const projectCard: StudioFeedCard = { id: `project:${p.id}`, projectIds: [p.id], title,
      caption: p.post.excerpt?.trim() || `A closer look at ${title}.`, imageUrl: images[0], imageUrls: images,
      kind: 'suggestion', format: 'Project story', status: 'suggested', updatedAt: p.post.updatedAt.toISOString(),
      canPolish: canWrite(p), preview: defaultPreview,
      pitch: `A ${images.length + 1}-slide introduction to ${title}.`,
      rationale: 'A project overview drawn from the published story.', beats: p.post.excerpt ? proposalOptions([p.post.excerpt.trim()]) : [],
      slideCount: images.length + 1, headlineOptions: proposalOptions([title]), captionOptions: proposalOptions([p.post.excerpt?.trim() || `A closer look at ${title}.`]) };
    sourceProposals.set(projectCard.id, projectCard);
    if (!sourceKeys.has(projectCard.id)) feed.push(projectCard);
    const roomCards: { card: StudioFeedCard; score: number }[] = [];
    for (const room of p.rooms || []) {
      const roomImages = photos.filter(image => image.roomId === room.id || (!image.roomId && (image.room === room.id || image.room === room.name))).slice(0, 4).map(image => image.url);
      if (!roomImages.length) continue;
      const id = `room:${p.id}:${room.id}`;
      const blocks = configObject(p.post.expandedBlocks);
      const chapters = Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters : [];
      const photoIds = new Set(photos.filter(image => roomImages.includes(image.url)).map(image => image.id));
      const chapter = chapters.map(configObject).find(c => c.roomId === room.id ||
        (!c.roomId && Array.isArray(c.imageIds) && c.imageIds.some(imageId => typeof imageId === 'string' && photoIds.has(imageId))));
      const proposal = publishedStoryProposal(chapter?.body);
      if (!proposal) continue;
      const roomTitle = room.name + ' at ' + title;
      roomCards.push({ score: proposal.score, card: { ...projectCard, id, roomId: room.id, title: roomTitle,
        caption: proposal.caption, pitch: proposal.pitch, rationale: proposal.rationale, beats: proposal.beats,
        headlineOptions: proposalOptions([roomTitle, 'The design decision: ' + room.name]), captionOptions: proposal.captionOptions,
        slideCount: roomImages.length + 1,
        imageUrl: roomImages[0], imageUrls: roomImages, format: 'Room story' } });
    }
    roomCards.forEach(({ card }) => sourceProposals.set(card.id, card));
    feed.push(...roomCards.filter(({ card }) => !sourceKeys.has(card.id)).sort((a, b) => b.score - a.score).slice(0, 3).map(entry => entry.card));
  }
  for (const s of saved) {
    const p = byId.get(s.projectId);
    if (!p) continue;
    const config = configObject(s.config);
    const proposal = typeof config.studioCardId === 'string' ? sourceProposals.get(config.studioCardId) : undefined;
    const bioSlides = config.bioEnabled !== false ? 1 : 0;
    const configuredSlides = [2, 3, 4, 5].includes(Number(config.slideCount)) ? Number(config.slideCount) : 5;
    const { imageUrl: first, imageUrls: images, preview } = savedPublicationPreview(config, p.images, p.designer?.name || 'Designer');
    feed.push({ id: `carousel:${s.id}`, projectIds: [p.id], title: s.headline ?? '', caption: s.caption ?? '',
      imageUrl: first, imageUrls: images, kind: 'carousel', format: 'Carousel', status: s.status,
      updatedAt: s.updatedAt.toISOString(), exportId: s.id, canPolish: canWrite(p), preview,
      pitch: typeof config.pitch === 'string' ? config.pitch : proposal?.pitch,
      rationale: typeof config.rationale === 'string' ? config.rationale : proposal?.rationale,
      beats: stringList(config.beats) ?? proposal?.beats, headlineOptions: stringList(config.headlineOptions) ?? proposal?.headlineOptions, captionOptions: stringList(config.captionOptions) ?? proposal?.captionOptions,
      slideCount: (images.length ? 1 : 0) + Math.min(Math.max(0, configuredSlides - 2 - bioSlides), Math.max(0, images.length - 1)) + 1 + bioSlides });
  }
  for (const c of campaigns) {
    const p = byId.get(c.projectId);
    const firstPost = c.posts[0];
    if (!p || !firstPost) continue;
    const images = (firstPost.imageIds || []).flatMap(id => { const image = p.images.find(i => i.id === id); return image ? [image.url] : []; });
    feed.push({ id: `campaign:${c.id}`, projectIds: [p.id], title: firstPost.title || `${p.title} campaign`,
      caption: firstPost.caption, imageUrl: images[0] || null, imageUrls: images, kind: 'campaign', format: 'Campaign',
      status: 'generated', updatedAt: c.createdAt.toISOString(), campaignId: c.id, canPolish: false });
  }
  for (const idea of ideas) {
    const images = idea.projectIds.flatMap(id => byId.get(id)?.images.filter(i => i.inclusion === 'INCLUDED').slice(0, 1).map(i => i.url) || []);
    feed.push({ id: `idea:${idea.id}`, projectIds: idea.projectIds, title: idea.title, caption: idea.reason,
      imageUrl: images[0] || null, imageUrls: images, kind: 'idea', format: idea.format,
      status: idea.status, updatedAt: idea.createdAt, canPolish: false });
  }
  return feed.map(card => card.kind === 'suggestion' ? { ...card, revision: createHash('sha256').update(JSON.stringify(card)).digest('hex') } : card);
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? proposalOptions(value.filter((v): v is string => typeof v === 'string')) : undefined;
}

export function preparedConfig(card: StudioFeedCard) {
  return { studioCardId: card.id, aspectRatio: '4:5', headlinePosition: 'bottom_left', watermarkStyle: 'minimal',
    opportunity: feedOpportunity(card, card.title),
    slideCount: card.imageUrls.length + 1, bioEnabled: false,
    pitch: card.pitch, rationale: card.rationale, beats: card.beats,
    headlineOptions: card.headlineOptions, captionOptions: card.captionOptions,
    selectedImageUrls: card.imageUrls, headline: card.title, ...(card.roomId ? { roomId: card.roomId } : {}) };
}
