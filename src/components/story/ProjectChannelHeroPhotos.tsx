'use client';
import { useEffect, useState, type ReactNode } from 'react';
import SafeImage from '@/components/SafeImage';
import styles from './ProjectChannelHeroPhotos.module.css';
import channel from './ProjectChannel.module.css';

export function ProjectChannelHeroPhotos({ images, title, attribution, description, heading, footer }: {
  images: { id: string; url: string; quote?: string }[];
  title: string;
  attribution: string | null;
  description?: string | null;
  heading: ReactNode;
  footer: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasQuotes = images.some(image => image.quote);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { setReduced(preference.matches); setHidden(document.hidden); };
    sync();
    preference.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { preference.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, []);
  let next = index;
  for (let step = 1; step < images.length; step++) {
    const candidate = (index + step) % images.length;
    if (!failed.has(images[candidate].url)) { next = candidate; break; }
  }
  const canAdvance = next !== index && loaded.has(images[next]?.url);
  const stopped = paused || reduced || hidden || (hasQuotes && (hovered || focused));
  useEffect(() => {
    if (!canAdvance || stopped) return;
    const timer = setTimeout(() => { setPrevious(index); setIndex(next); }, 7000);
    return () => clearTimeout(timer);
  }, [canAdvance, index, next, stopped]);
  return <section className={channel.hero} aria-label={title}
    onMouseEnter={hasQuotes ? () => setHovered(true) : undefined} onMouseLeave={hasQuotes ? () => setHovered(false) : undefined}
    onFocusCapture={hasQuotes ? () => setFocused(true) : undefined}
    onBlurCapture={hasQuotes ? event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); } : undefined}>
    <div aria-hidden="true" className="absolute inset-0" data-hero-index={index}>
      {images.map((image, i) => {
        // Load one ahead. Retain decoded layers (at most five) so no-store photo
        // sources never flash an unloaded image on the next rotation.
        if (i !== index && i !== previous && !loaded.has(image.url) && (i !== next || reduced || hidden)) return null;
        return <div key={image.id} className={`absolute inset-0 transition-opacity duration-[1600ms] motion-reduce:transition-none ${index === i ? 'opacity-100' : 'opacity-0'}`}>
          <SafeImage src={image.url} alt={title} fill priority={i === 0} loading={i === 0 ? undefined : 'eager'} sizes="100vw"
            onLoad={() => setLoaded(value => new Set(value).add(image.url))}
            onError={() => setFailed(value => new Set(value).add(image.url))}
            className={`object-cover ${index === i && !reduced ? styles.motion : ''}`}
            style={{ animationPlayState: stopped ? 'paused' : 'running' }} />
        </div>;
      })}
    </div>
    {images.length > 1 && !reduced && <button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused}
      className="absolute right-5 top-5 z-10 min-h-11 rounded-full border border-[var(--folio-border-subtle)] bg-[var(--surface-canvas)] px-4 text-xs text-[var(--folio-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
      {paused ? 'Resume photographs' : 'Pause photographs'}
    </button>}
    <div aria-hidden="true" className={channel.heroShade} />
    <div className={channel.heroContent}>
      {heading}
      {hasQuotes ? <div className={channel.heroCopy} aria-live="off">
        {/* Grid layers reserve the tallest copy so the title and actions stay still. */}
        {description && <p className={`${channel.deck} ${channel.copyLayer}`} data-active={!images[index]?.quote} aria-hidden={Boolean(images[index]?.quote)}>{description}</p>}
        {images.map((image, i) => image.quote ? <figure key={image.id} className={`${channel.quote} ${channel.copyLayer}`}
          data-hero-quote={image.id} data-active={index === i} aria-hidden={index !== i}>
          <blockquote>“{image.quote}”</blockquote>
          <figcaption>{attribution ? `— ${attribution}, from the Folio Feature` : 'From the Folio Feature'}</figcaption>
        </figure> : null)}
      </div> : description ? <p className={channel.deck}>{description}</p> : null}
      {footer}
    </div>
  </section>;
}
