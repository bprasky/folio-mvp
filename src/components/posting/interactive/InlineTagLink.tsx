'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { track } from '@/lib/interactive/analytics';

type ProductMini = {
  id: string;
  name: string;
  vendorName?: string;
  imageUrl?: string;
  slug?: string;
};

async function fetchProduct(productId: string): Promise<ProductMini | null> {
  try {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      id: d.id,
      name: d.name,
      vendorName: d.vendorName,
      imageUrl: d.imageUrl,
      slug: d.slug,
    };
  } catch {
    return null;
  }
}

export default function InlineTagLink({
  productId,
  label,
  onAddToBoard,
}: {
  productId: string;
  label: string;
  onAddToBoard?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProductMini | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open || data) return;
    fetchProduct(productId).then((d) => {
      setData(d);
      track({ ev: 'open_hover_card', productId });
    });
  }, [open, data, productId]);

  return (
    <span
      ref={ref}
      className="relative font-medium underline decoration-dotted underline-offset-4 cursor-pointer text-[var(--accent)]/90 hover:text-[var(--accent-hover)]"
      onMouseEnter={() => {
        setOpen(true);
        track({ ev: 'hover_tag', productId, source: 'inline' });
      }}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      {label}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 8, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl p-3 shadow-xl backdrop-blur bg-white/95 border border-[var(--ridge-outer)]"
          >
            {data ? (
              <div className="flex gap-3">
                {data.imageUrl ? (
                  <img
                    src={data.imageUrl}
                    alt={data.name}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-[var(--bg-elevated)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{data.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{data.vendorName}</div>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={data.slug ? `/product/${data.slug}` : `/products/${productId}`}
                      className="text-xs px-2 py-1 rounded-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent-hover)]"
                    >
                      View
                    </a>
                    {onAddToBoard && (
                      <button
                        className="text-xs px-2 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
                        onClick={() => {
                          onAddToBoard(productId);
                          track({ ev: 'save_to_board', productIds: [productId], source: 'inline' });
                        }}
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-secondary)]">Loading…</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

