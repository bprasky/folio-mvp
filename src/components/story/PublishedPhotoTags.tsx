'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ImmersiveRooms.module.css';

interface PublishedProduct {
  id: string;
  name?: string | null;
  isPending?: boolean;
  [key: string]: unknown;
}
interface PhotoTag {
  id: string;
  x: number;
  y: number;
  product?: PublishedProduct | null;
}
type PlacedTag = PhotoTag & { product: PublishedProduct };

// ProductTag coordinates are stored as percentages, including values below 1.
export function publishablePhotoTags(tags: PhotoTag[] | undefined): PlacedTag[] {
  return (tags ?? []).filter((tag): tag is PlacedTag => tag.product?.id && !tag.product.isPending
    && Number.isFinite(tag.x) && Number.isFinite(tag.y)
    && tag.x >= 0 && tag.x <= 100 && tag.y >= 0 && tag.y <= 100);
}

export function PublishedPhotoTags({ tags, aspect, topAligned, onProductClick }: {
  tags: PlacedTag[]; aspect: number; topAligned: boolean; onProductClick: (product: PublishedProduct) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  // Match object-fit:contain and the publication's mobile object-position.
  const width = Math.min(size.width, size.height * aspect);
  const height = width / aspect;
  return <div ref={container} className={`${styles.photo} ${styles.tagLayer}`}>
    {size.width > 0 && <div style={{ position: 'absolute', width, height,
      left: (size.width - width) / 2, top: topAligned ? 0 : (size.height - height) / 2 }}>
      {tags.map(tag => <button key={tag.id} type="button" className={styles.productDot}
        style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
        aria-label={`View ${tag.product.name || 'product'}`} title={tag.product.name || 'View product'}
        onTouchStart={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); onProductClick({ ...tag.product, productTagId: tag.id }); }} />)}
    </div>}
  </div>;
}
