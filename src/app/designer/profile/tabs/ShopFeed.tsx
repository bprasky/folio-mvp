'use client';

import { useState, useMemo } from 'react';
import MosaicGrid, { MosaicCell } from '../MosaicGrid';
import ProductCard from '../cards/ProductCard';
import type { ProfileProduct } from '../types';

interface ShopFeedProps {
  products: ProfileProduct[];
}

export default function ShopFeed({ products }: ShopFeedProps) {
  const [category, setCategory] = useState('All');

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return ['All', ...Array.from(cats).sort()];
  }, [products]);

  const filtered = useMemo(
    () => (category === 'All' ? products : products.filter(p => p.category === category)),
    [products, category]
  );

  // Sort by projectCount descending so most-specified appears first
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.projectCount - a.projectCount),
    [filtered]
  );

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
            <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="folio-body" style={{ color: 'var(--text-tertiary)' }}>
          Tag products in your project photos to build your shop.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Category filter pills */}
      {categories.length > 2 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="shop-filter-pill"
              data-active={category === c}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <MosaicGrid>
        {sorted.map((product, i) => (
          <MosaicCell key={product.id} size={i === 0 ? 'medium' : 'small'}>
            <ProductCard product={product} />
          </MosaicCell>
        ))}
      </MosaicGrid>

      <style jsx>{`
        .shop-filter-pill {
          padding: 5px 14px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .shop-filter-pill[data-active='true'] {
          border-color: var(--text-primary);
          background: var(--text-primary);
          color: var(--bg-base);
        }
        .shop-filter-pill:hover:not([data-active='true']) {
          border-color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
