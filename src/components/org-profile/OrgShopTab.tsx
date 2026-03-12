'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SafeImage from '@/components/SafeImage';

export interface OrgProduct {
  id: string;
  name: string;
  vendor: string;
  imageUrl: string | null;
  cropUrl: string | null;
  price: string | number | null;
  category: string | null;
  projectCount: number;
  sourceImageUrl: string | null;
  projectTitle: string | null;
  projectId: string | null;
}

interface OrgShopTabProps {
  products: OrgProduct[];
}

type Size = 'L' | 'M' | 'S';

function assignSizes(products: OrgProduct[]): { item: OrgProduct; size: Size }[] {
  const ranked = [...products].sort((a, b) => b.projectCount - a.projectCount);
  const n = ranked.length;
  const largeCount = Math.max(1, Math.floor(n * 0.10));
  const mediumCount = Math.max(2, Math.floor(n * 0.35));
  const Ls = ranked.slice(0, largeCount).map(item => ({ item, size: 'L' as const }));
  const Ms = ranked.slice(largeCount, largeCount + mediumCount).map(item => ({ item, size: 'M' as const }));
  const Ss = ranked.slice(largeCount + mediumCount).map(item => ({ item, size: 'S' as const }));

  const out: { item: OrgProduct; size: Size }[] = [];
  const take = (arr: typeof Ls) => arr.length ? out.push(arr.shift()!) : null;
  while (Ls.length || Ms.length || Ss.length) {
    take(Ls); take(Ms); take(Ss); take(Ms); take(Ss); take(Ms);
  }
  return out;
}

function spanFor(size: Size) {
  if (size === 'L') return { colSpan: 2, rowSpan: 30 };
  if (size === 'M') return { colSpan: 2, rowSpan: 24 };
  return { colSpan: 1, rowSpan: 20 };
}

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

export default function OrgShopTab({ products }: OrgShopTabProps) {
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<OrgProduct | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
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
          style={{ background: '#F0EDE9' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8B8178" strokeWidth="1.5">
            <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)', fontSize: '15px', color: '#8B8178' }}>
          No products yet
        </p>
        <p style={{ fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)', fontSize: '13px', color: '#A69E96', marginTop: '4px' }}>
          Products tagged in projects will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {categories.length > 2 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="px-3.5 py-1.5 rounded-full text-[12px] border transition-colors"
              style={{
                borderColor: category === c ? '#2C2825' : '#E8E4DF',
                backgroundColor: category === c ? '#2C2825' : 'transparent',
                color: category === c ? '#FAF9F7' : '#8B8178',
                fontFamily: 'var(--font-body, "Instrument Sans", sans-serif)',
                cursor: 'pointer',
              }}
            >
              {c === 'All' ? 'All' : getCategoryLabel(c)}
            </button>
          ))}
        </div>
      )}

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
                <div className="relative flex h-full items-end p-3">
                  <div className="text-white w-full">
                    <div className={`font-semibold leading-tight ${size === 'L' ? 'text-lg' : size === 'M' ? 'text-base' : 'text-sm'}`}>
                      {item.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-white/80 text-[11px]">
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

      <AnimatePresence>
        {selectedProduct && (
          <OrgProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function OrgProductModal({
  product,
  onClose,
}: {
  product: OrgProduct;
  onClose: () => void;
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
      <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
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
          <div className="md:w-3/5 flex flex-col">
            <div className="relative aspect-square md:aspect-[4/3] bg-stone-100">
              {displayImage ? (
                <SafeImage src={displayImage} alt={product.name} fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-medium text-stone-300">
                    {product.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {product.sourceImageUrl && (
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
                      <span className="text-white/90 text-[11px] font-medium">
                        From: {product.projectTitle}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="md:w-2/5 flex flex-col overflow-y-auto p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold" style={{ color: '#2C2825' }}>{product.name}</h2>
              {product.vendor && (
                <p className="text-[14px] mt-1" style={{ color: '#A69E96' }}>{product.vendor}</p>
              )}
              {formattedPrice && (
                <p className="text-[14px] mt-1 font-medium" style={{ color: '#5C554D' }}>{formattedPrice}</p>
              )}
            </div>
            {product.category && (
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full text-[12px]" style={{ backgroundColor: '#F0EDE9', color: '#8B8178' }}>
                  {getCategoryLabel(product.category)}
                </span>
              </div>
            )}
            {product.projectCount > 0 && (
              <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: '#FAF9F7' }}>
                <p className="text-[13px]" style={{ color: '#8B8178' }}>
                  Featured in <span className="font-medium" style={{ color: '#5C554D' }}>{product.projectCount} project{product.projectCount !== 1 ? 's' : ''}</span>
                </p>
              </div>
            )}
            {product.projectId && (
              <div className="mt-auto pt-4">
                <a
                  href={`/project/${product.projectId}`}
                  className="w-full py-3 px-6 rounded-xl text-[14px] font-medium border text-center block no-underline transition-colors"
                  style={{ borderColor: '#E8E4DF', color: '#5C554D' }}
                >
                  View in Project
                </a>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
