import { getSelectedRoomLineText, type PullQuoteSelection } from '@/lib/posting/schemas';
import { readPresentation, presentationTokens } from '@/lib/story/presentation';

/** The same source selection and drawing instructions power preview and export. */
export interface PublicationPhoto {
  projectName: string;
  firmName: string;
  location: string;
  roomName: string;
  quote: string | null;
  attribution: string | null;
  accent: string | null;
}

interface PhotoSource { id: string; url: string; room?: string | null; roomId?: string | null }
const clean = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function publicationPhotos(projectInput: unknown, postInput: unknown, images: PhotoSource[], designerInput: unknown): Record<string, PublicationPhoto> {
  const project = record(projectInput), designer = record(designerInput), blocks = record(record(postInput).expandedBlocks);
  const chapters = Array.isArray(blocks.galleryChapters) ? blocks.galleryChapters.map(record) : [];
  const accent = readPresentation(blocks.presentation).accent;
  return Object.fromEntries(images.map(image => {
    const chapter = chapters.find(ch => Array.isArray(ch.imageIds) && ch.imageIds.includes(image.id))
      ?? chapters.find(ch => Array.isArray(ch.images) && ch.images.some(candidate => record(candidate).id === image.id || record(candidate).url === image.url))
      ?? chapters.find(ch => image.roomId && ch.roomId === image.roomId);
    const paragraphs = Array.isArray(chapter?.body) ? chapter.body : [chapter?.body ?? chapter?.narrative];
    const hasStory = paragraphs.some((text: unknown) => clean(text)) || !!clean(chapter?.description);
    const quote = hasStory ? clean(getSelectedRoomLineText(chapter?.pullQuote as string | PullQuoteSelection | null | undefined)) || null : null;
    const folioAuthored = record(chapter?.pullQuote).authorship === 'folio';
    return [image.url, {
      projectName: clean(project?.title),
      firmName: clean(record(project.designerOrg).name) || clean(designer.studio) || clean(designer.companyName) || clean(designer.name),
      location: [clean(project?.city), clean(project?.regionState)].filter(Boolean).join(', '),
      roomName: clean(chapter?.title) || clean(image.room) || 'Project detail',
      quote: quote || null,
      attribution: quote && !folioAuthored ? clean(record(project.designerOrg).name) || clean(designer.studio) || clean(designer.name) || null : null,
      accent,
    }];
  }));
}

/** A compact change token for stale previews, not an authorization credential. */
export function publicationRevision(photos: Record<string, PublicationPhoto>): string {
  const source = JSON.stringify(Object.entries(photos).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  let first = 2166136261, second = 5381;
  for (let i = 0; i < source.length; i++) {
    first = Math.imul(first ^ source.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ source.charCodeAt(i);
  }
  return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}-${source.length}`;
}

export const PUBLICATION_FONTS = {
  headline: 'Folio Publication Headline',
  body: 'Folio Publication Body',
};

export interface PhotoLayout {
  identity: string[];
  room: string[];
  quote: string[];
  attribution: string[];
  quoteSize: number;
  roomSize: number;
  identitySize: number;
  cardY: number;
  cardHeight: number;
  photoHeight: number;
}

/** Word wrapping measures the actual bundled fonts, including long unbroken names. */
export function wrapPublicationText(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, width: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) { line = next; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const character of word) {
      if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function font(ctx: CanvasRenderingContext2D, size: number, headline = false) {
  ctx.font = `400 ${size}px "${headline ? PUBLICATION_FONTS.headline : PUBLICATION_FONTS.body}"`;
}

export function publicationPhotoLayout(ctx: CanvasRenderingContext2D, photo: PublicationPhoto, width: number, height: number): PhotoLayout {
  const scale = width / 1080;
  const available = width - 190 * scale;
  const identitySize = 29 * scale;
  font(ctx, identitySize);
  const identity = wrapPublicationText(ctx, [photo.projectName, photo.firmName, photo.location].filter(Boolean).join(' · '), available);
  const roomSize = 43 * scale;
  font(ctx, roomSize);
  const room = wrapPublicationText(ctx, photo.roomName.toLocaleUpperCase(), available);
  const displayedQuote = photo.quote ? photo.attribution ? `“${photo.quote.replace(/^[“"]|[”"]$/g, '')}”` : photo.quote : '';
  let quoteSize = 69 * scale;
  let quote: string[] = [];
  const fixedHeight = (identity.length * 40 + room.length * 54 + (photo.attribution ? 68 : 0) + 145) * scale;
  do {
    font(ctx, quoteSize, true);
    quote = wrapPublicationText(ctx, displayedQuote, available);
    if (fixedHeight + quote.length * quoteSize * 1.12 <= height * .48 || quoteSize <= 43 * scale) break;
    quoteSize -= 2 * scale;
  } while (true);
  font(ctx, 28 * scale);
  const attribution = photo.attribution ? wrapPublicationText(ctx, `— ${photo.attribution}`, available) : [];
  const cardHeight = photo.quote
    ? 112 * scale + identity.length * 40 * scale + room.length * 54 * scale + quote.length * quoteSize * 1.12 + (attribution.length ? 30 * scale + attribution.length * 36 * scale : 0)
    : 0;
  const cardY = height - 33 * scale - cardHeight;
  return { identity, room, quote, attribution, identitySize, roomSize, quoteSize, cardY, cardHeight, photoHeight: photo.quote ? Math.max(height * .4, cardY + 45 * scale) : height };
}

function fitPhoto(ctx: CanvasRenderingContext2D, image: CanvasImageSource, imageWidth: number, imageHeight: number, x: number, y: number, width: number, height: number, cover: boolean) {
  const factor = cover ? Math.max(width / imageWidth, height / imageHeight) : Math.min(width / imageWidth, height / imageHeight);
  const w = imageWidth * factor, h = imageHeight * factor;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

/** No navigation or reading affordances are part of this exportable composition. */
export function drawPublicationPhoto(ctx: CanvasRenderingContext2D, image: CanvasImageSource, imageWidth: number, imageHeight: number, photo: PublicationPhoto, width: number, height: number): PhotoLayout {
  const scale = width / 1080;
  const tokens = presentationTokens(photo.accent);
  const layout = publicationPhotoLayout(ctx, photo, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = tokens.background;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.filter = `blur(${60 * scale}px)`;
  fitPhoto(ctx, image, imageWidth, imageHeight, -90 * scale, -90 * scale, width + 180 * scale, height + 180 * scale, true);
  ctx.restore();
  ctx.fillStyle = tokens.background;
  ctx.globalAlpha = .18;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  // Prioritize the top edge and center horizontally. Fade the lower edge into
  // the same photograph's ambient background without cropping its composition.
  const photoScale = Math.min(width / imageWidth, layout.photoHeight / imageHeight);
  const photoWidth = imageWidth * photoScale, photoHeight = imageHeight * photoScale;
  const photoX = (width - photoWidth) / 2;
  const fadeHeight = Math.min(90 * scale, photoHeight * .08);
  const solidHeight = photoHeight - fadeHeight;
  ctx.drawImage(image, 0, 0, imageWidth, solidHeight / photoScale, photoX, 0, photoWidth, solidHeight);
  for (let y = solidHeight; y < photoHeight; y += 2 * scale) {
    const strip = Math.min(2 * scale, photoHeight - y);
    ctx.globalAlpha = (photoHeight - y) / fadeHeight;
    ctx.drawImage(image, 0, y / photoScale, imageWidth, strip / photoScale, photoX, y, photoWidth, strip);
  }
  ctx.globalAlpha = 1;

  const shade = ctx.createLinearGradient(0, 0, 0, 250 * scale);
  shade.addColorStop(0, 'rgba(0,0,0,.36)'); shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, width, 250 * scale);
  ctx.fillStyle = '#fffdf8';
  font(ctx, 65 * scale, true);
  const letters = ['F', 'O', 'L', 'I', 'O'];
  const tracking = 13 * scale;
  const markWidth = letters.reduce((sum, letter) => sum + ctx.measureText(letter).width, 0) + tracking * 4;
  let markX = (width - markWidth) / 2;
  for (const letter of letters) { ctx.fillText(letter, markX, 116 * scale); markX += ctx.measureText(letter).width + tracking; }

  if (!photo.quote) {
    const bottomShade = ctx.createLinearGradient(0, height - 200 * scale, 0, height);
    bottomShade.addColorStop(0, 'rgba(0,0,0,0)'); bottomShade.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = bottomShade; ctx.fillRect(0, height - 200 * scale, width, 200 * scale);
    ctx.fillStyle = '#fffdf8'; font(ctx, layout.roomSize);
    layout.room.forEach((line, index) => ctx.fillText(line, 65 * scale, height - (layout.room.length - index) * 54 * scale));
    return layout;
  }

  const x = 33 * scale, w = width - x * 2, radius = 82 * scale;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, layout.cardY, w, layout.cardHeight, radius); ctx.clip();
  ctx.filter = `blur(${45 * scale}px)`;
  fitPhoto(ctx, image, imageWidth, imageHeight, -90 * scale, -90 * scale, width + 180 * scale, height + 180 * scale, true);
  ctx.filter = 'none';
  ctx.fillStyle = tokens.glass;
  ctx.fillRect(x, layout.cardY, w, layout.cardHeight);
  const glint = ctx.createLinearGradient(x, layout.cardY, x + w, layout.cardY + layout.cardHeight);
  glint.addColorStop(0, 'rgba(255,255,255,.2)'); glint.addColorStop(.18, 'rgba(255,255,255,0)'); glint.addColorStop(1, 'rgba(255,255,255,.07)');
  ctx.fillStyle = glint; ctx.fillRect(x, layout.cardY, w, layout.cardHeight);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2 * scale;
  ctx.beginPath(); ctx.roundRect(x, layout.cardY, w, layout.cardHeight, radius); ctx.stroke();
  ctx.fillStyle = tokens.text;
  const textX = 95 * scale;
  let y = layout.cardY + 65 * scale;
  font(ctx, layout.identitySize);
  layout.identity.forEach(line => { ctx.fillText(line, textX, y); y += 40 * scale; });
  y += 14 * scale;
  font(ctx, layout.roomSize);
  layout.room.forEach(line => { ctx.fillText(line, textX, y); y += 54 * scale; });
  y += 26 * scale;
  font(ctx, layout.quoteSize, true);
  layout.quote.forEach(line => { ctx.fillText(line, textX, y); y += layout.quoteSize * 1.12; });
  if (layout.attribution.length) {
    y += 10 * scale; font(ctx, 28 * scale);
    layout.attribution.forEach(line => { ctx.fillText(line, textX, y); y += 36 * scale; });
  }
  return layout;
}
