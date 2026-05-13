'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useScroll, useTransform, motion } from 'framer-motion';
import { ProductFloatFallback } from './ProductFloatFallback';
import { ActionIconBar } from '@/components/project/interaction/ActionIconBar';
import { useSaveToProjectFolder } from '@/components/projects/useSaveToProjectFolder';
import SaveToFolderModal from '@/components/projects/SaveToFolderModal';
import { resolveProductImage } from './productImageHelper';

const ProductFloatMesh = dynamic(() => import('./ProductFloatMesh'), {
  ssr: false,
});

interface Product {
  id: string;
  name: string;
  imageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[];
  thumbnailUrl?: string | null;
  threeDAssetUrl?: string | null;
  mesh3dUrl?: string | null;
  brand?: string | null;
  vendor?: { name?: string | null } | null;
}

interface EditorialProductFloatProps {
  products: Product[];
  roomName?: string | null;
}

/**
 * Floating 3D product display for magazine editorials.
 * Products render on transparent background with scroll-bound rotation.
 * Replaces the old card-based ProductInsertBlock.
 */
export function EditorialProductFloat({ products, roomName }: EditorialProductFloatProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { openSaveDialog, modalProps } = useSaveToProjectFolder();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  if (!products.length) return null;

  return (
    <aside
      ref={containerRef}
      className="w-full py-10 md:py-14 col-span-12 md:col-span-4 md:col-start-9 lg:col-span-4 lg:col-start-9"
    >
      {roomName && (
        <p className="text-[var(--type-fine)] uppercase tracking-[var(--ls-eyebrow)] text-folio-text-secondary mb-4">
          {products.length} {products.length === 1 ? 'piece' : 'pieces'} selected for {roomName}
        </p>
      )}

      <div className="flex flex-col gap-8">
        {products.map((product) => {
          const meshUrl = product.threeDAssetUrl || product.mesh3dUrl;
          const imageUrl = resolveProductImage(product);
          const vendorName = product.vendor?.name || product.brand || null;
          const isHovered = hoveredId === product.id;
          const productHref = `/products/${product.id}`;

          return (
            <div
              key={product.id}
              className="flex flex-col items-center"
              onMouseEnter={() => setHoveredId(product.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 3D mesh or image fallback — no container/card */}
              <motion.div
                className="w-full aspect-square"
                animate={{
                  scale: isHovered ? 1.15 : 1,
                }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {meshUrl ? (
                  <ProductFloatMesh
                    glbUrl={meshUrl}
                    scrollProgress={scrollYProgress}
                    isHovered={isHovered}
                  />
                ) : imageUrl ? (
                  <ProductFloatFallback imageUrl={imageUrl} name={product.name} />
                ) : null}
              </motion.div>

              {/* Product label */}
              <div className="text-center mt-2">
                <a href={productHref} className="hover:underline">
                  <span className="text-sm font-headline text-folio-text-primary">
                    {product.name}
                  </span>
                </a>
                {vendorName && (
                  <p className="text-[var(--type-fine)] uppercase tracking-[var(--ls-eyebrow)] text-folio-text-secondary mt-0.5">
                    {vendorName}
                  </p>
                )}
              </div>

              {/* Action icons — visible on hover only */}
              <ActionIconBar
                isVisible={isHovered}
                onView={() => window.location.href = productHref}
                onAddToProject={() => {
                  openSaveDialog({
                    productId: product.id,
                    source: 'editorial-product-float',
                  });
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Save to Project Modal */}
      {modalProps.productId && (
        <SaveToFolderModal
          isOpen={modalProps.isOpen}
          onClose={modalProps.onClose}
          productId={modalProps.productId}
          eventId={modalProps.eventId}
          eventTitle={modalProps.eventTitle}
          onSuccess={modalProps.onSuccess}
        />
      )}
    </aside>
  );
}
