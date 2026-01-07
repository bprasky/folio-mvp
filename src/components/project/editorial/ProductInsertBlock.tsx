'use client';

import Image from 'next/image';
import { resolveProductImage } from './productImageHelper';

interface Product {
  id: string;
  name: string;
  imageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[];
  thumbnailUrl?: string | null;
}

interface ProductInsertBlockProps {
  products: Product[];
  roomName?: string | null;
  isBoosted?: boolean;
  featuredQuestions?: Array<{ productId: string; questions: string[] }>;
  mode?: 'published' | 'edit';
  featuredReason?: string;
}

/**
 * ProductInsertBlock - Margin note style product callout
 * 
 * Renders as compact margin note docked to caption column width (col-span-4 = 1/3).
 * Should never be visually larger than caption region.
 * Feels like editorial margin note, not a section.
 */
export function ProductInsertBlock({ products, roomName, isBoosted, featuredQuestions, mode = 'published', featuredReason }: ProductInsertBlockProps) {
  const primaryProduct = products[0];
  const hasProducts = products.length > 0;
  
  // Only show as "Featured" if we have questions (evidence-based) OR featuredReason
  const isFeatured = (mode === 'edit' && featuredQuestions && featuredQuestions.length > 0) || (mode === 'published' && featuredReason);
  const isEditMode = mode === 'edit';
  
  // Resolve product image using helper
  const productImageUrl = hasProducts ? resolveProductImage(primaryProduct) : null;
  
  // Get questions for primary product (only in edit mode)
  const primaryProductQuestions = isEditMode && featuredQuestions ? featuredQuestions.find(q => q.productId === primaryProduct.id)?.questions || [] : [];

  return (
    <aside className="w-full py-10 md:py-14 col-span-12 md:col-span-4 md:col-start-9 lg:col-span-4 lg:col-start-9">
      <div className="flex flex-col gap-3">
        {/* Small Square Thumbnail */}
        <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-xl overflow-hidden bg-neutral-100 shadow-sm">
          {productImageUrl ? (
            <Image
              src={productImageUrl}
              alt={primaryProduct.name}
              fill
              className="object-cover"
              sizes="128px"
              onError={(e) => {
                if (process.env.NODE_ENV !== 'production') {
                  console.error('[ProductInsertBlock] Image load error:', {
                    productId: primaryProduct.id,
                    productName: primaryProduct.name,
                    src: productImageUrl,
                  });
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-200">
              <div className="text-center p-4">
                <div className="text-2xl mb-2">📐</div>
                {isFeatured && (
                  <p className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider">
                    Featured
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Featured Badge - Only show if questions exist */}
          {isFeatured && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-medium text-neutral-700 uppercase tracking-wider">
              Featured
            </div>
          )}
        </div>
        
        {/* Tight Text Stack - Margin Note Style */}
        <div className="space-y-2">
          {/* Product Name */}
          {hasProducts ? (
            <>
              <h4 className="text-sm font-serif font-light text-neutral-900 leading-tight">
                {primaryProduct.name}
              </h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {products.length > 1 
                  ? `${products.length} pieces selected for ${roomName || 'this space'}.`
                  : `Selected for ${roomName || 'this space'}.`
                }
              </p>
            </>
          ) : (
            <>
              <h4 className="text-sm font-serif font-light text-neutral-900">
                Featured Detail
              </h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                A carefully selected piece.
              </p>
            </>
          )}
          
          {/* Questions Section - NEVER show in published mode */}
          {mode === 'edit' && primaryProductQuestions.length > 0 && (
            <div className="pt-3 border-t border-neutral-200">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 mb-2">
                Questions Folio would ask
              </div>
              <ul className="space-y-1.5">
                {primaryProductQuestions.map((question, idx) => (
                  <li key={idx} className="text-xs text-neutral-600 leading-relaxed">
                    {idx + 1}. {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Featured Reason - Only show in published mode */}
          {mode === 'published' && featuredReason && (
            <div className="pt-3 border-t border-neutral-200">
              <p className="text-xs text-neutral-600 leading-relaxed italic">
                {featuredReason}
              </p>
            </div>
          )}
          
          {/* Minimal CTA - Single button, very subtle */}
          <button
            className="text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2 transition-colors"
            disabled
            aria-label="View product"
          >
            View
          </button>
        </div>
      </div>
    </aside>
  );
}

