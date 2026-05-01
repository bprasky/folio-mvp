"use client";

// ProductSheet — Desktop: right side panel. Mobile: bottom sheet.
// Shows product image, in-situ context, designer quote, vendor link.
// Rule: the mosaic stays visible (side panel, not modal).

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface ProductSheetProps {
  product: any | null;
  onClose: () => void;
  designerName: string;
  supplementalQuotes: any[];
}

function resolveImage(product: any): string | null {
  return (
    product?.primaryImageUrl ||
    product?.imageUrl ||
    product?.thumbnailUrl ||
    product?.imageUrls?.[0] ||
    product?.cutoutImageUrl ||
    null
  );
}

function getProductQuote(
  product: any,
  supplementalQuotes: any[]
): { text: string; role: string } | null {
  if (!product?.id) return null;
  // Find a supplemental quote referencing this product
  const match = supplementalQuotes.find(
    (sq: any) => sq.productTagId && sq.answer
  );
  if (match) {
    return { text: match.answer, role: match.contributorRole || "Designer" };
  }
  return null;
}

export function ProductSheet({
  product,
  onClose,
  designerName,
  supplementalQuotes,
}: ProductSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (product) {
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [product, onClose]);

  const imageUrl = product ? resolveImage(product) : null;
  const vendorName =
    product?.vendor?.name || product?.vendor?.companyName || null;
  const vendorUrl = product?.vendor?.website || null;
  const quote = product ? getProductQuote(product, supplementalQuotes) : null;

  return (
    <AnimatePresence>
      {product && (
        <>
          {/* Backdrop — subtle on desktop, more visible on mobile */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/10 md:bg-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Desktop: Right side panel */}
          <motion.div
            ref={sheetRef}
            className="fixed z-50 hidden md:flex flex-col top-0 right-0 h-full overflow-y-auto"
            style={{
              width: 400,
              maxWidth: "40vw",
              background: "rgba(255, 252, 248, 0.88)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderLeft: "1px solid rgba(255, 252, 248, 0.4)",
              boxShadow: "-8px 0 32px rgba(87, 75, 67, 0.06)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <SheetContent
              product={product}
              imageUrl={imageUrl}
              vendorName={vendorName}
              vendorUrl={vendorUrl}
              designerName={designerName}
              quote={quote}
              onClose={onClose}
            />
          </motion.div>

          {/* Mobile: Bottom sheet */}
          <motion.div
            className="fixed z-50 md:hidden left-0 right-0 bottom-0 overflow-y-auto rounded-t-[20px]"
            style={{
              maxHeight: "70vh",
              background: "rgba(255, 252, 248, 0.95)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: "0 -8px 32px rgba(87, 75, 67, 0.12)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-[rgba(87,75,67,0.15)]" />
            </div>
            <SheetContent
              product={product}
              imageUrl={imageUrl}
              vendorName={vendorName}
              vendorUrl={vendorUrl}
              designerName={designerName}
              quote={quote}
              onClose={onClose}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetContent({
  product,
  imageUrl,
  vendorName,
  vendorUrl,
  designerName,
  quote,
  onClose,
}: {
  product: any;
  imageUrl: string | null;
  vendorName: string | null;
  vendorUrl: string | null;
  designerName: string;
  quote: { text: string; role: string } | null;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Close button */}
      <button
        onClick={onClose}
        className="self-end text-[rgba(87,75,67,0.4)] hover:text-[rgba(87,75,67,0.7)] transition-colors"
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M5 5L15 15M15 5L5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Product image */}
      {imageUrl && (
        <div className="relative w-full aspect-square rounded-[12px] overflow-hidden bg-[rgba(87,75,67,0.04)]">
          <Image
            src={imageUrl}
            alt={product.name || "Product"}
            fill
            className="object-contain"
            sizes="400px"
          />
        </div>
      )}

      {/* Product name + vendor */}
      <div>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: "rgba(87, 75, 67, 0.85)"
          }}
        >
          {product.name}
        </h3>
        {vendorName && (
          <p
            style={{
              fontSize: "14px",
              color: "rgba(87, 75, 67, 0.55)"
            }}
          >
            {vendorName}
          </p>
        )}
      </div>

      {/* Designer quote about product */}
      {quote && (
        <blockquote
          className="border-l-2 pl-4 py-1"
          style={{
            borderColor: "rgba(87, 75, 67, 0.1)",
            fontFamily: "var(--font-headline)",
            fontSize: "16px",
            fontStyle: "italic",
            color: "rgba(87, 75, 67, 0.7)",
          }}
        >
          &ldquo;{quote.text}&rdquo;
          <footer
            className="mt-1 not-italic"
            style={{
              fontSize: "11px",
              color: "rgba(87, 75, 67, 0.4)"
            }}
          >
            &mdash; {designerName}, {quote.role}
          </footer>
        </blockquote>
      )}

      {/* Vendor outbound link */}
      {vendorUrl && (
        <a
          href={vendorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 transition-colors"
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(87, 75, 67, 0.7)",
            border: "1px solid rgba(87, 75, 67, 0.12)"
          }}
        >
          View at {vendorName || "vendor"}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M4 2H10V8M10 2L2 10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
    </div>
  );
}
