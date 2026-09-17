import type { HeadlinePosition } from '@/lib/instagram-export/svg-templates';

/** Same first-slide composition in the ideas feed and the carousel editor. */
export function CarouselHero({ imageUrl, headline, headlinePosition = 'bottom_left', watermarkText = 'folio' }: {
  imageUrl?: string;
  headline: string;
  headlinePosition?: HeadlinePosition;
  watermarkText?: string;
}) {
  const top = headlinePosition === 'top_left';
  return <div className="relative h-full w-full overflow-hidden bg-surface-ground" style={{ containerType: 'inline-size' }}>
    {imageUrl && <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */}
    <div className="absolute inset-0" style={{ background: `linear-gradient(${top ? '180deg' : '0deg'}, rgba(0,0,0,.58), transparent 65%)` }} />
    <div className="absolute left-[8%] right-[8%] text-white" style={{ [top ? 'top' : 'bottom']: '15%', textAlign: headlinePosition === 'bottom_center' ? 'center' : 'left' }}>
      <p className="break-words font-[family-name:var(--font-headline)] italic" style={{ color: '#FFFFFF', fontSize: '7cqi', lineHeight: 'var(--lh-h4)', textShadow: '0 1px 8px rgba(0,0,0,.3)' }}>{headline}</p>
    </div>
    <span className="absolute right-[8%] font-[family-name:var(--font-body)] lowercase text-white/70" style={{ [top ? 'top' : 'bottom']: '6%', fontSize: '2.4cqi', letterSpacing: 'var(--ls-wide)' }}>{watermarkText}</span>
  </div>;
}
