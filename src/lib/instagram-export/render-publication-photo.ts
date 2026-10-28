import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import path from 'node:path';
import sharp from 'sharp';
import { drawPublicationPhoto, PUBLICATION_FONTS, type PublicationPhoto } from './publication-photo';

let fontsLoaded = false;
function ensureFonts() {
  if (fontsLoaded) return;
  const directory = path.join(process.cwd(), 'public', 'fonts', 'publication');
  const headline = GlobalFonts.registerFromPath(path.join(directory, 'CormorantGaramond.ttf'), PUBLICATION_FONTS.headline);
  const body = GlobalFonts.registerFromPath(path.join(directory, 'InstrumentSans.ttf'), PUBLICATION_FONTS.body);
  if (!headline || !body) throw new Error('Publication fonts could not load');
  fontsLoaded = true;
}

export async function renderPublicationPhoto(buffer: Buffer, photo: PublicationPhoto, width: number, height: number): Promise<Buffer> {
  ensureFonts();
  const normalized = await sharp(buffer, { limitInputPixels: 64_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const image = await loadImage(normalized);
  const canvas = createCanvas(width, height);
  drawPublicationPhoto(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, image as unknown as CanvasImageSource, image.width, image.height, photo, width, height);
  return canvas.encode('jpeg', 95);
}
