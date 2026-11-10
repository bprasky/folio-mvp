'use client';
import { useEffect, useState } from 'react';
import SafeImage from '@/components/SafeImage';
export function ProjectChannelHeroPhotos({ images, title }: { images: { id: string; url: string }[]; title: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (timer) clearInterval(timer);
      if (!document.hidden) timer = setInterval(() => setIndex(value => (value + 1) % images.length), 7000);
    };
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { if (timer) clearInterval(timer); document.removeEventListener('visibilitychange', sync); };
  }, [images.length]);
  return <div aria-hidden="true" className="absolute inset-0">
    {images.map((image, i) => <div key={image.id} className={`absolute inset-0 transition-opacity duration-[1600ms] motion-reduce:transition-none ${index === i ? 'opacity-100' : 'opacity-0'}`}>
      <SafeImage src={image.url} alt={title} fill priority={i === 0} sizes="100vw" className={`object-cover motion-safe:transition-transform motion-safe:duration-[8500ms] ${index === i ? 'motion-safe:scale-[1.025]' : 'scale-100'}`} />
    </div>)}
  </div>;
}
