import { createGradientOverlaySVG, createHeadlineSVG, createWatermarkTextSVG, type HeadlinePosition } from '@/lib/instagram-export/svg-templates';

/** Exact export SVG layers over the selected image, also reused by the editor. */
export function CarouselHero({ imageUrl, headline, headlinePosition = 'bottom_left', watermarkText = 'folio', aspectRatio = '4:5' }: {
  imageUrl?: string; headline: string; headlinePosition?: HeadlinePosition; watermarkText?: string; aspectRatio?: '1:1' | '4:5' | '9:16';
}) {
  const width = 1080, height = aspectRatio === '1:1' ? 1080 : aspectRatio === '9:16' ? 1920 : 1350;
  const layers = [createGradientOverlaySVG(width, height, headlinePosition), createHeadlineSVG(headline, width, height, headlinePosition), createWatermarkTextSVG(watermarkText, width, height, headlinePosition)];
  return <div role="img" aria-label={headline} className="relative h-full w-full overflow-hidden bg-surface-ground">
    {imageUrl && <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
    {layers.map((svg, index) => <img key={index} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />)}
  </div>;
}
