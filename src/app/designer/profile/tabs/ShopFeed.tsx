'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SafeImage from '@/components/SafeImage';
import AddToProjectModal from '@/components/events/AddToProjectModal';
import type { ProfileProduct } from '../types';

interface ShopFeedProps {
  products: ProfileProduct[];
}

/* ─── Sizing logic (adapted from FlowMosaic) ─── */

type Size = 'L' | 'M' | 'S';

function assignSizes(products: ProfileProduct[]): { item: ProfileProduct; size: Size }[] {
  // Sort by projectCount descending (most-used = most prominent)
  const ranked = [...products].sort((a, b) => b.projectCount - a.projectCount);
  const n = ranked.length;

  const largeCount = Math.max(1, Math.floor(n * 0.10));
  const mediumCount = Math.max(2, Math.floor(n * 0.35));
  const Ls = ranked.slice(0, largeCount).map(item => ({ item, size: 'L' as const }));
  const Ms = ranked.slice(largeCount, largeCount + mediumCount).map(item => ({ item, size: 'M' as const }));
  const Ss = ranked.slice(largeCount + mediumCount).map(item => ({ item, size: 'S' as const }));

  // Interleave: L, M, S, M, S, M pattern
  const out: { item: ProfileProduct; size: Size }[] = [];
  const take = (arr: typeof Ls) => arr.length ? out.push(arr.shift()!) : null;

  while (Ls.length || Ms.length || Ss.length) {
    take(Ls);
    take(Ms);
    take(Ss);
    take(Ms);
    take(Ss);
    take(Ms);
  }
  return out;
}

const rowUnit = 8;

function spanFor(size: Size) {
  if (size === 'L') return { colSpan: 2, rowSpan: 30 }; // ~240px
  if (size === 'M') return { colSpan: 2, rowSpan: 24 }; // ~192px
  return { colSpan: 1, rowSpan: 20 }; // ~160px
}

/* ─── Category labels ─── */

const CATEGORY_LABELS: Record<string, string> = {
  LIGHTING: 'Lighting',
  FURNITURE: 'Furniture',
  HARDWARE: 'Hardware',
  PLUMBING_FIXTURE: 'Plumbing',
  RUG: 'Rugs',
  TEXTILE: 'Textiles',
  ART: 'Art',
  ACCESSORY: 'Accessories',
  APPLIANCE: 'Appliances',
  WINDOW_TREATMENT: 'Window Treatments',
};

function getCategoryLabel(category?: string | null): string {
  if (!category) return 'Other';
  return CATEGORY_LABELS[category.toUpperCase()] ?? category;
}

/* ─── Main Component ─── */

export default function ShopFeed({ products }: ShopFeedProps) {
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<ProfileProduct | null>(null);
  const [addToProjectProduct, setAddToProjectProduct] = useState<ProfileProduct | null>(null);

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

  const sized = useMemo(() => assignSizes(filtered), [filtered]);

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-ground)' }}
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
              {c === 'All' ? 'All' : getCategoryLabel(c)}
            </button>
          ))}
        </div>
      )}

      {/* FlowMosaic-style grid */}
      <div className="grid grid-flow-dense gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[8px]">
        {sized.map(({ item, size }) => {
          const { colSpan, rowSpan } = spanFor(size);
          const displayImage = item.cropUrl || item.imageUrl || '';

          return (
            <article
              key={item.id}
              className={`group relative rounded-[20px] overflow-hidden cursor-pointer col-span-${colSpan}`}
              style={{ gridRowEnd: `span ${rowSpan}` }}
              onClick={() => setSelectedProduct(item)}
            >
              <div className="relative h-full">
                <div className="absolute inset-0">
                  <SafeImage
                    src={displayImage}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                </div>

                {/* Content overlay */}
                <div className="relative flex h-full items-end p-3">
                  <div className="text-white w-full">
                    <div className={`font-semibold leading-tight ${size === 'L' ? 'text-lg' : size === 'M' ? 'text-base' : 'text-sm'}`}>
                      {item.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-white/80 text-[var(--type-eyebrow)]">
                      {item.vendor && <span>{item.vendor}</span>}
                      {item.projectCount > 1 && (
                        <span className="inline-flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 backdrop-blur-sm">
                          In {item.projectCount} projects
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Product-in-context modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ShopProductContextModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAddToProject={() => {
              setAddToProjectProduct(selectedProduct);
              setSelectedProduct(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Add to project modal */}
      <AddToProjectModal
        isOpen={!!addToProjectProduct}
        onClose={() => setAddToProjectProduct(null)}
        productId={addToProjectProduct?.id || ''}
        onSuccess={() => setAddToProjectProduct(null)}
      />

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
          color: var(--surface-canvas);
        }
        .shop-filter-pill:hover:not([data-active='true']) {
          border-color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}

/* ─── Product-in-Context Modal ─── */

function ShopProductContextModal({
  product,
  onClose,
  onAddToProject,
}: {
  product: ProfileProduct;
  onClose: () => void;
  onAddToProject: () => void;
}) {
  const displayImage = product.cropUrl || product.imageUrl || '';
  const formattedPrice =
    product.price != null
      ? typeof product.price === 'number'
        ? `$${product.price.toLocaleString()}`
        : product.price
      : null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2C2825" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row max-h-[90vh]">
          {/* Left: Images */}
          <div className="md:w-3/5 flex flex-col">
            {/* Contextual crop — the hero image */}
            <div className="relative aspect-square md:aspect-[4/3] bg-stone-100">
              {displayImage ? (
                <SafeImage
                  src={displayImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-body text-2xl font-medium text-stone-300">
                    {product.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Source project image — shows the product in context */}
            {product.sourceImageUrl && (
              <div className="relative">
                <div className="p-1 bg-stone-100">
                  <div className="relative aspect-[3/1] rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.sourceImageUrl}
                      alt={`${product.name} in context`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {product.projectTitle && (
                      <div className="absolute bottom-2 left-3">
                        <span className="text-white/90 text-[var(--type-eyebrow)] font-medium">
                          From: {product.projectTitle}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Info + Actions */}
          <div className="md:w-2/5 flex flex-col overflow-y-auto p-6 md:p-8">
            {/* Product info */}
            <div className="mb-6">
              <h2 className="font-body text-xl font-semibold text-stone-800">
                {product.name}
              </h2>
              {product.vendor && (
                <p className="font-body text-[var(--type-ui)] text-stone-400 mt-1">
                  {product.vendor}
                </p>
              )}
              {formattedPrice && (
                <p className="font-body text-[var(--type-ui)] text-stone-600 mt-1 font-medium">
                  {formattedPrice}
                </p>
              )}
            </div>

            {/* Category badge */}
            {product.category && (
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full bg-stone-100 font-body text-[var(--type-meta)] text-stone-500">
                  {getCategoryLabel(product.category)}
                </span>
              </div>
            )}

            {/* Project count */}
            {product.projectCount > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-stone-50">
                <p className="font-body text-[var(--type-meta)] text-stone-500">
                  Featured in <span className="font-medium text-stone-700">{product.projectCount} project{product.projectCount !== 1 ? 's' : ''}</span> by this designer
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-auto space-y-3 pt-4">
              <button
                onClick={onAddToProject}
                className="w-full py-3 px-6 rounded-xl font-body text-[var(--type-ui)] font-medium text-white transition-colors"
                style={{ backgroundColor: '#2C2825' }}
              >
                Add to Project
              </button>

              {product.projectId && (
                <a
                  href={`/project/${product.projectId}`}
                  className="w-full py-3 px-6 rounded-xl font-body text-[var(--type-ui)] font-medium border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors text-center block"
                >
                  View in Project
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
