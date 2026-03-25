"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, Bookmark } from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { logStorySignal } from "@/app/actions/posting";
import type { StoryProductData } from "@/lib/editorial/buildRoomCards";

interface Props {
  product: StoryProductData | null;
  inSituImages: { url: string; id: string }[];
  supplementalQuotes: any[];
  isDesktop: boolean;
  onClose: () => void;
  projectId?: string;
  postSlug?: string;
}

export function ProductSheet({
  product,
  inSituImages,
  supplementalQuotes,
  isDesktop,
  onClose,
  projectId,
  postSlug,
}: Props) {
  const isOpen = product !== null;

  // Find supplemental quote for this product
  const quote = product
    ? supplementalQuotes.find((q: any) => q.productTagId === product.tagId)
    : null;

  const vendorName = product?.vendor?.companyName ?? product?.vendor?.name;
  const vendorUrl = product?.vendor?.website;

  // Signal: PRODUCT_TAP
  useEffect(() => {
    if (product && projectId && postSlug) {
      logStorySignal(projectId, postSlug, "PRODUCT_TAP", {
        tagId: product.tagId,
        productId: product.id,
      });
    }
  }, [product, projectId, postSlug]);

  // --- Desktop: Radix Sheet side panel ---
  if (isDesktop) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="story-glass-panel w-[400px] max-w-[40vw] p-0 border-l-0 overflow-y-auto"
        >
          {product && (
            <ProductSheetContent
              product={product}
              inSituImages={inSituImages}
              quote={quote}
              vendorName={vendorName}
              vendorUrl={vendorUrl}
              onClose={onClose}
            />
          )}
        </SheetContent>
      </Sheet>
    );
  }

  // --- Mobile: Bottom sheet with Framer Motion ---
  return (
    <AnimatePresence>
      {isOpen && product && (
        <>
          {/* Backdrop */}
          <motion.div
            key="product-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="product-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={(_e, info) => {
              if (info.velocity.y > 300 || info.offset.y > 150) {
                onClose();
              }
            }}
            className="fixed bottom-0 left-0 right-0 z-50 story-glass-sheet max-h-[75vh] overflow-y-auto"
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-[rgba(87,75,67,0.2)]" />
            </div>

            <ProductSheetContent
              product={product}
              inSituImages={inSituImages}
              quote={quote}
              vendorName={vendorName}
              vendorUrl={vendorUrl}
              onClose={onClose}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Shared inner content ---

function ProductSheetContent({
  product,
  inSituImages,
  quote,
  vendorName,
  vendorUrl,
  onClose,
}: {
  product: StoryProductData;
  inSituImages: { url: string; id: string }[];
  quote: any;
  vendorName: string | undefined;
  vendorUrl: string | undefined;
  onClose: () => void;
}) {
  const productImageUrl = product.cropUrl ?? product.imageUrl ?? product.thumbnailUrl;

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Close button (mobile — desktop uses Radix SheetClose) */}
      <div className="flex justify-end lg:hidden">
        <button onClick={onClose} className="p-1 rounded-full hover:bg-[rgba(87,75,67,0.08)]">
          <X className="w-5 h-5 story-text-secondary" />
        </button>
      </div>

      {/* Product image + in-situ thumbnails */}
      <div className="flex gap-3">
        {productImageUrl && (
          <div className="w-32 h-32 rounded-xl overflow-hidden bg-[rgba(87,75,67,0.06)] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {inSituImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {inSituImages.slice(0, 3).map((img) => (
              <div key={img.id} className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt="In context"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Product name + vendor */}
      <div>
        <h3 className="text-[18px] font-[var(--font-body)] font-medium story-text-on-light">
          {product.name}
        </h3>
        {vendorName && (
          <p className="text-[14px] font-[var(--font-body)] story-text-secondary mt-0.5">
            {vendorName}
          </p>
        )}
      </div>

      {/* Designer quote */}
      {quote?.answer && (
        <>
          <div className="border-t border-[rgba(87,75,67,0.1)]" />
          <blockquote className="font-[var(--font-headline)] italic text-[17px] leading-relaxed story-text-on-light">
            &ldquo;{quote.answer}&rdquo;
          </blockquote>
        </>
      )}

      {/* Cross-project signal (placeholder) */}
      <div className="border-t border-[rgba(87,75,67,0.1)]" />
      <p className="text-[13px] font-[var(--font-body)] story-text-secondary">
        Tagged by designers on Folio
      </p>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[rgba(87,75,67,0.08)] text-[14px] font-[var(--font-body)] font-medium story-text-on-light hover:bg-[rgba(87,75,67,0.12)] transition-colors">
          <Bookmark className="w-4 h-4" />
          Save Product
        </button>
        {vendorUrl && (
          <a
            href={vendorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[rgba(87,75,67,0.08)] text-[14px] font-[var(--font-body)] font-medium story-text-on-light hover:bg-[rgba(87,75,67,0.12)] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View at Vendor
          </a>
        )}
      </div>
    </div>
  );
}
