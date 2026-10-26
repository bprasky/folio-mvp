"use client";

// ProductSheet — Desktop: right side panel. Mobile: bottom sheet.
// Shows product image, in-situ context, designer quote, vendor link.
// Keep the mosaic visible behind the drawer while focus stays within it.

import { useRef } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";

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
  const previousFocus = useRef<HTMLElement | null>(null);
  const swipeStart = useRef<number | null>(null);
  if (!product) return null;
  const imageUrl = resolveImage(product);
  const vendorName = product.vendor?.name || product.vendor?.companyName || null;
  const vendorUrl = product.vendor?.website || null;
  const quote = getProductQuote(product, supplementalQuotes);

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[79] bg-black/10 md:bg-transparent" />
      <Dialog.Content aria-describedby={undefined}
        className="fixed inset-x-0 bottom-0 z-[80] max-h-[70dvh] w-full overflow-y-auto overscroll-contain rounded-t-[20px] bg-surface-canvas shadow-xl backdrop-blur-xl focus:outline-none md:inset-x-auto md:inset-y-0 md:right-0 md:h-dvh md:max-h-dvh md:w-[400px] md:max-w-[40vw] md:rounded-none md:border-l md:border-folio-border-subtle"
        style={{ backgroundColor: 'color-mix(in srgb, var(--surface-canvas) 95%, transparent)' }}
        onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={event => { event.preventDefault(); previousFocus.current?.focus(); }}>
        {/* Swipe the handle to dismiss; swiping the content remains native scrolling. */}
        <div aria-hidden className="flex touch-none justify-center py-3 md:hidden"
          onPointerDown={event => { swipeStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerCancel={() => { swipeStart.current = null; }}
          onPointerUp={event => { if (swipeStart.current !== null && event.clientY - swipeStart.current > 100) onClose(); swipeStart.current = null; }}>
          <div className="h-1 w-10 rounded-full bg-folio-border-strong" />
        </div>
        <SheetContent product={product} imageUrl={imageUrl} vendorName={vendorName} vendorUrl={vendorUrl} designerName={designerName} quote={quote} onClose={onClose} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
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
        className="sticky top-0 flex h-11 w-11 shrink-0 self-end items-center justify-center rounded-full bg-surface-canvas text-folio-text-secondary hover:text-folio-text-primary transition-colors"
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
        <Dialog.Title className="break-words"
          style={{
            fontSize: 'var(--type-body)',
            fontWeight: 'var(--w-h1)',
            color: "rgba(87, 75, 67, 0.85)"
          }}
        >
          {product.name}
        </Dialog.Title>
        {vendorName && (
          <p
            style={{
              fontSize: 'var(--type-ui)',
              color: "var(--folio-text-secondary)"
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
            fontSize: 'var(--type-body)',
            fontStyle: "italic",
            color: "var(--folio-text-secondary)",
          }}
        >
          &ldquo;{quote.text}&rdquo;
          <footer
            className="mt-1 not-italic"
            style={{
              fontSize: 'var(--type-eyebrow)',
              color: "var(--folio-text-secondary)"
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
            fontSize: 'var(--type-meta)',
            fontWeight: 'var(--w-h1)',
            color: "var(--folio-text-secondary)",
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
