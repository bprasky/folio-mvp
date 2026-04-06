'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { track } from '@/lib/interactive/analytics';
import Image from 'next/image';

// paragraphs[i] -> related imageId(s)
export default function ScrollSyncPanel({
  imageMap, // array of imageIds aligned with narrative paragraphs
  imagesById, // { [id]: url }
}: {
  imageMap: string[]; 
  imagesById: Record<string, string>;
}) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paras = Array.from(document.querySelectorAll('[data-paragraph-idx]')) as HTMLElement[];
    if (paras.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number(e.target.getAttribute('data-paragraph-idx') || '0');
            setActive(idx);
            const img = imageMap[idx];
            if (img) track({ ev: 'scroll_sync_image', imageId: img, paragraphIndex: idx });
          }
        });
      },
      { rootMargin: '-30% 0% -50% 0%', threshold: 0.1 }
    );

    paras.forEach((p) => obs.observe(p));
    return () => obs.disconnect();
  }, [imageMap]);

  const currentImage = imagesById[imageMap[active]] || imagesById[imageMap[0]] || '';

  if (!currentImage) return null;

  return (
    <div ref={containerRef} className="sticky top-28 h-[50vh] rounded-[20px] overflow-hidden shadow-lg bg-surface-ground">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage || 'empty'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="relative w-full h-full"
        >
          <Image
            src={currentImage}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 420px"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


