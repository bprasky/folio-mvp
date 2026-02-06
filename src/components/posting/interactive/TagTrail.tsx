'use client';

import { useEffect, useState } from 'react';
import { track } from '@/lib/interactive/analytics';

export default function TagTrail({
  resolveTag, // (productId) => {label, href}
}: {
  resolveTag: (productId: string) => { label: string; href?: string } | null;
}) {
  const [activeProductIds, setActive] = useState<string[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const ids = new Set<string>();
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const list = e.target.getAttribute('data-product-ids');
            if (list) list.split(',').forEach((id) => ids.add(id));
          }
        });
        setActive(Array.from(ids));
      },
      { rootMargin: '-40% 0% -55% 0%', threshold: 0.15 }
    );
    
    const elements = document.querySelectorAll('[data-product-ids]');
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  if (!activeProductIds.length) return null;

  return (
    <div className="sticky top-16 z-30 mx-auto mb-3 w-full max-w-5xl rounded-full border border-gray-200 bg-white/90 px-4 py-2 backdrop-blur shadow-sm">
      <div className="text-xs text-gray-500 mb-1">Now featuring:</div>
      <div className="flex flex-wrap gap-2">
        {activeProductIds.map((id) => {
          const meta = resolveTag(id);
          if (!meta) return null;

          return (
            <a
              key={id}
              href={meta.href || '#'}
              className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent-hover)] hover:bg-[var(--accent)]/20 transition-colors"
              onMouseEnter={() => track({ ev: 'hover_tag', productId: id, source: 'trail' })}
            >
              {meta.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}


