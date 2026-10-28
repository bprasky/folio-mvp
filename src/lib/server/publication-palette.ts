import sharp from 'sharp';
import { fetchProjectImage } from './project-image-input';
import { readProtectedProjectPhoto } from './protected-project-photo';
import { primaryPhotoColors } from '@/lib/story/presentation';

/** Called only after project authorization. Sample across the project rather than its first room. */
export async function publicationPalette(projectId: string, imageUrls: string[]): Promise<string[]> {
  const unique = Array.from(new Set(imageUrls.filter(Boolean)));
  const sampleCount = Math.min(8, unique.length);
  const urls = Array.from({ length: sampleCount }, (_, index) => unique[sampleCount === 1 ? 0 : Math.round(index * (unique.length - 1) / (sampleCount - 1))]);
  const samples: Uint8Array[] = [];
  for (let start = 0; start < urls.length; start += 4) {
    const results = await Promise.allSettled(urls.slice(start, start + 4).map(async url => {
      const photo = await readProtectedProjectPhoto(url, projectId) || await fetchProjectImage(url);
      return sharp(photo.buffer, { limitInputPixels: 40_000_000 })
        .rotate().resize(64, 64, { fit: 'cover' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
    }));
    for (const result of results) if (result.status === 'fulfilled') samples.push(result.value);
  }
  // Failed or unavailable photos do not become fictitious black/white choices.
  return primaryPhotoColors(samples);
}
