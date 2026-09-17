import { createHash } from 'crypto';
import type { StudioFeedCard, StudioData } from './types';

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

/** Pure source assembly: no generation, writes, unpublished interviews, or invented quotations. */
export function buildStudioFeed(projects: Project[], saved: Saved[], campaigns: Campaign[], ideas: StudioData['ideas'], userId: string, orgWrite: boolean): StudioFeedCard[] {
  const feed: StudioFeedCard[] = [];
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
      canPolish: canWrite(p), preview: defaultPreview };
    if (!sourceKeys.has(projectCard.id)) feed.push(projectCard);
    let roomCount = 0;
    for (const room of p.rooms || []) {
      if (roomCount === 3) break;
      const roomImages = photos.filter(image => image.roomId === room.id || (!image.roomId && (image.room === room.id || image.room === room.name))).slice(0, 4).map(image => image.url);
      if (!roomImages.length) continue;
      const id = `room:${p.id}:${room.id}`;
      if (sourceKeys.has(id)) continue;
      const blocks = configObject(p.post.expandedBlocks);
      const chapters = Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters : [];
      const photoIds = new Set(photos.filter(image => roomImages.includes(image.url)).map(image => image.id));
      const chapter = chapters.map(configObject).find(c => c.roomId === room.id ||
        (Array.isArray(c.imageIds) && c.imageIds.some(imageId => typeof imageId === 'string' && photoIds.has(imageId))));
      const prose = chapter && Array.isArray(chapter.body) ? chapter.body.filter((line): line is string => typeof line === 'string' && Boolean(line.trim())).slice(0, 1).join(' ').trim() : '';
      // Without published room copy this would only be a generic prompt, not a prepared post.
      if (!prose) continue;
      feed.push({ ...projectCard, id, roomId: room.id, title: `${room.name} at ${title}`,
        caption: prose,
        imageUrl: roomImages[0], imageUrls: roomImages, format: 'Room story' });
      roomCount++;
    }
  }
  for (const s of saved) {
    const p = byId.get(s.projectId);
    if (!p) continue;
    const config = configObject(s.config);
    const allowed = new Set(p.images.map(image => image.url));
    const requested = Array.isArray(config.selectedImageUrls) ? config.selectedImageUrls : [];
    const images = requested.filter((url): url is string => typeof url === 'string' && allowed.has(url));
    // Do not substitute a project hero for a missing saved first image.
    const first = typeof requested[0] === 'string' && allowed.has(requested[0]) ? requested[0] : null;
    const preview = { ...defaultPreview, watermarkStyle: 'folio_x' as const } as NonNullable<StudioFeedCard['preview']>;
    if (['1:1', '4:5', '9:16'].includes(String(config.aspectRatio))) preview.aspectRatio = config.aspectRatio as typeof preview.aspectRatio;
    if (['bottom_left', 'bottom_center', 'top_left'].includes(String(config.headlinePosition))) preview.headlinePosition = config.headlinePosition as typeof preview.headlinePosition;
    if (['folio_x', 'folio_presents', 'minimal'].includes(String(config.watermarkStyle))) preview.watermarkStyle = config.watermarkStyle as typeof preview.watermarkStyle;
    const designerName = typeof config.designerName === 'string' ? config.designerName : p.designer?.name || 'Designer';
    preview.watermarkText = preview.watermarkStyle === 'minimal' ? 'folio'
      : preview.watermarkStyle === 'folio_presents' ? 'a folio editorial' : `folio × ${designerName.toLowerCase()}`;
    feed.push({ id: `carousel:${s.id}`, projectIds: [p.id], title: s.headline ?? '', caption: s.caption ?? '',
      imageUrl: first, imageUrls: images, kind: 'carousel', format: 'Carousel', status: s.status,
      updatedAt: s.updatedAt.toISOString(), exportId: s.id, canPolish: canWrite(p), preview });
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

export function preparedConfig(card: StudioFeedCard) {
  return { studioCardId: card.id, aspectRatio: '4:5', headlinePosition: 'bottom_left', watermarkStyle: 'minimal',
    slideCount: Math.max(3, Math.min(5, card.imageUrls.length + 1)), bioEnabled: false,
    selectedImageUrls: card.imageUrls, headline: card.title, ...(card.roomId ? { roomId: card.roomId } : {}) };
}
