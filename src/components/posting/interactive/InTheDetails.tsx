'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { track } from '@/lib/interactive/analytics';
import Image from 'next/image';

export default function InTheDetails({
  productIds,
  products, // [{id,name,imageUrl}]
  onSaveAll,
}: {
  productIds: string[];
  products: { id: string; name: string; imageUrl?: string }[];
  onSaveAll?: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  if (productIds.length === 0) return null;

  return (
    <div className="mt-10">
      <button
        className="rounded-xl bg-surface-ground px-4 py-2 text-sm font-medium text-folio-text-primary hover:bg-surface-ground transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        In the Details {open ? '▲' : '▼'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {products.map((p) => (
                <figure key={p.id} className="group">
                  {p.imageUrl ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-ground">
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        fill
                        className="object-cover group-hover:opacity-90 transition-opacity"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-xl bg-surface-ground" />
                  )}
                  <figcaption className="mt-1 truncate text-xs text-folio-text-secondary">{p.name}</figcaption>
                </figure>
              ))}
            </div>
            {onSaveAll && (
              <div className="mt-4">
                <button
                  className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-200 transition-colors"
                  onClick={() => {
                    onSaveAll(productIds);
                    track({ ev: 'save_to_board', productIds, source: 'details' });
                  }}
                >
                  Save all to Board
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


